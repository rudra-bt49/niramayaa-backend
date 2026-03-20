import { StateGraph, MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { AgentState, PatientDetailsSchema } from "./chatbot.types";
import { getExtractionPrompt, getIntentExtractionPrompt, getConversationalPrompt } from "./chatbot.prompts";
import { cleanExtractedData } from "./chatbot.util";
import { z } from "zod";
import { appointmentService } from "../../appointment/appointment.service";
import prisma from "../../../prisma/prisma"; 
import * as fs from "fs";
const llm = new ChatOpenAI({
    model: "openai/gpt-oss-120b", 
    temperature: 0,
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
    },
});

const extractionLlmStructured = llm.withStructuredOutput(PatientDetailsSchema);
const intentLlmStructured = llm.withStructuredOutput(z.object({ confirmed: z.boolean().nullable() }));
const conversationalLlm = new ChatOpenAI({
    model: "openai/gpt-oss-120b",
    temperature: 0.6,
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
    },
});

const extractorNode = async (state: typeof AgentState.State) => {
    // Look at last 10 messages for context
    const recentMessages = state.messages.slice(-20);
    
    // 1. Extract Details — wrapped in try/catch because OpenRouter can return empty output
    //    which causes OUTPUT_PARSING_FAILURE. On failure we return no new fields (safe default).
    let cleaned: Partial<typeof state.collected_data> = {};
    try {
        const extracted = await extractionLlmStructured.invoke([getExtractionPrompt(), ...recentMessages]);
        cleaned = cleanExtractedData(extracted);
    } catch (err) {
        console.warn("[extractorNode] Extraction LLM failed, using empty result:", (err as any)?.lc_error_code ?? err);
    }
    
    // Identify what was newly added vs updated
    const newlyExtracted = Object.keys(cleaned).filter(key => !(state.collected_data as any)[key]);
    const updatedFields = Object.keys(cleaned).filter(key => 
        (state.collected_data as any)[key] && (state.collected_data as any)[key] !== (cleaned as any)[key]
    );

    // 2. Extract Intent (only if all fields are already collected)
    const required = ["description", "height", "weight", "blood_group"];
    const allPresent = required.every(field => (state.collected_data as any)[field] || (cleaned as any)[field]);
    
    let isConfirmed = state.is_confirmed;
    let detailsShown = state.details_shown;

    // Reset confirmation and details shown if user updated something
    if (updatedFields.length > 0) {
        isConfirmed = false;
        detailsShown = false;
    }

    if (allPresent) {
        const lastHumanMessage = [...state.messages].reverse().find(m => m._getType() === "human");
        const lastText = (lastHumanMessage?.content as string || "").trim().toLowerCase();

        // --- Hardcoded affirmative check (fast path, no LLM needed) ---
        const AFFIRMATIVES = ["yes", "y", "ok", "okay", "sure", "correct", "yep", "yeah", "yup",
                              "proceed", "confirm", "book it", "go ahead", "looks good", "alright",
                              "that's right", "book", "done", "sounds good", "fine", "absolutely",
                              "definitely", "of course", "go on", "let's go", "lets go", "agreed"];
        const NEGATIVES = ["no", "nope", "cancel", "stop", "wrong", "not correct", "change"];

        const isHardAffirm = AFFIRMATIVES.some(kw => lastText === kw || lastText.startsWith(kw + " ") || lastText.endsWith(" " + kw));
        const isHardNegate = NEGATIVES.some(kw => lastText === kw || lastText.startsWith(kw + " "));

        if (isHardAffirm && !isHardNegate) {
            isConfirmed = true;
        } else if (isHardNegate) {
            isConfirmed = false;
            detailsShown = false;
        } else {
            // Fall back to LLM only for ambiguous messages
            try {
                const intentMessages = lastHumanMessage ? [lastHumanMessage] : recentMessages;
                const intentResult = await intentLlmStructured.invoke([getIntentExtractionPrompt(), ...intentMessages]);
                if (intentResult.confirmed === true) isConfirmed = true;
                if (intentResult.confirmed === false) {
                    isConfirmed = false;
                    detailsShown = false;
                }
            } catch (err) {
                console.warn("[extractorNode] Intent LLM failed, leaving confirmation unchanged:", (err as any)?.lc_error_code ?? err);
                // Leave isConfirmed as-is — responder will re-ask the user
            }
        }
    }

    return { 
        collected_data: cleaned,
        newly_extracted_fields: newlyExtracted,
        updated_fields: updatedFields,
        is_confirmed: isConfirmed,
        details_shown: detailsShown
    };
};

const validatorNode = async (state: typeof AgentState.State) => {
    const required = ["description", "height", "weight", "blood_group"];
    const currentData = state.collected_data;
    const missing = required.filter(field => !(currentData as any)[field]);
    // Explicitly forward is_confirmed so it is guaranteed to be in state
    // before routeAfterValidation fires — eliminates node-ordering ambiguity.
    return { missing_fields: missing, is_confirmed: state.is_confirmed };
};

const responderNode = async (state: typeof AgentState.State) => {
    // Safety guard: if the user is confirmed AND all fields exist in collected_data,
    // the booker should have run — this is a fallback for edge cases.
    const required = ["description", "height", "weight", "blood_group"];
    const allDataPresent = required.every(f => (state.collected_data as any)[f]);
    if (allDataPresent && state.is_confirmed) {
        return {
            messages: [new AIMessage("Almost there! Generating your payment link now...")],
            details_shown: true
        };
    }
    
    const recentMessages = state.messages.slice(-20);
    const prompt = getConversationalPrompt(
        state.missing_fields, 
        state.newly_extracted_fields,
        state.updated_fields,
        state.is_confirmed,
        state.collected_data,
        state.details_shown
    );
    const response = await conversationalLlm.invoke([prompt, ...recentMessages]);

    // If all details are present, we are showing them now
    const detailsShown = state.missing_fields.length === 0;

    return { 
        messages: [response],
        details_shown: detailsShown
    };
};

const bookerNode = async (state: typeof AgentState.State) => {
    try {
        if (!state.booking_context.doctor_id) throw new Error("Doctor ID missing from context");
        if (!state.booking_context.patient_id) throw new Error("Patient ID missing from context");

        // 1. Fetch the patient's existing profile from the database
        const patient = await prisma.user.findUnique({
            where: { id: state.booking_context.patient_id! }
        });

        if (!patient) {
            throw new Error("Patient profile not found in database.");
        }

        // 2. Rehydrate serialized Buffers
        const validFiles = (state.files || []).map((file: any) => {
            if (file.buffer && file.buffer.type === 'Buffer' && Array.isArray(file.buffer.data)) {
                return { ...file, buffer: Buffer.from(file.buffer.data) };
            }
            return file; 
        }) as Express.Multer.File[];

        // 3. Build the request body, falling back to database values if context is missing them
        const reqBody = {
            doctor_id: state.booking_context.doctor_id!,
            start_at: state.booking_context.start_at!,
            end_at: state.booking_context.end_at!,
           
            name: state.booking_context.name || `${patient.first_name} ${patient.last_name}`,
            email: state.booking_context.email || patient.email || "",
            phone: state.booking_context.phone || patient.phone_number || "", 
            gender: state.booking_context.gender || patient.gender  ,
            
            description: state.collected_data.description!,
            height: state.collected_data.height!,
            weight: state.collected_data.weight!,
            blood_group: state.collected_data.blood_group! ,
        };

        // 4. Call the strict appointment service
        const bookingResult = await appointmentService.initiateBookingSession({
            userId: state.booking_context.patient_id!,
            body: reqBody,
            files: validFiles, 
        });

        return { 
            checkout_url: bookingResult.checkoutUrl,
            messages: [new AIMessage("✅ All set! Click the button below to complete your payment and secure your appointment slot.")]
        };
    } catch (error: any) {
        const errMsg = error.message || "Failed to generate appointment.";
        // Return error both as state (for service layer) and as a visible chat message
        return { 
            error: errMsg,
            messages: [new AIMessage(`❌ Something went wrong: ${errMsg}\n\nPlease try again or contact support if the issue persists.`)]
        };
    }
};

// --- ROUTING LOGIC ---
const routeAfterValidation = (state: typeof AgentState.State) => {
    const required = ["description", "height", "weight", "blood_group"];
    // Use both missing_fields list AND a direct collected_data check to avoid
    // any state-timing edge cases where missing_fields could be stale.
    const noMissingFields = state.missing_fields.length === 0;
    const allDataPresent = required.every(f => (state.collected_data as any)[f]);
    if ((noMissingFields || allDataPresent) && state.is_confirmed) {
        return "booker";
    }
    return "responder";
};

// --- BUILD GRAPH ---
const builder = new StateGraph(AgentState)
    .addNode("extractor", extractorNode)
    .addNode("validator", validatorNode)
    .addNode("responder", responderNode)
    .addNode("booker", bookerNode)
    
    .addEdge("__start__", "extractor")
    .addEdge("extractor", "validator")
    .addConditionalEdges("validator", routeAfterValidation)
    .addEdge("responder", "__end__")
    .addEdge("booker", "__end__");

const graph=builder.compile({ checkpointer: new MemorySaver() });
console.log(graph.getGraph().drawMermaid());
export const chatBookingGraph = graph;