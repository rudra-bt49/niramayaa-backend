import { StateGraph, MemorySaver } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { AgentState, PatientDetailsSchema } from "./chatbot.types";
import { getExtractionPrompt, getIntentExtractionPrompt, getConversationalPrompt } from "./chatbot.prompts";
import { cleanExtractedData } from "./chatbot.util";
import { z } from "zod";
import { appointmentService } from "../../appointment/appointment.service";
import prisma from "../../../prisma/prisma";

const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    temperature: 0,
});

const extractionLlmStructured = llm.withStructuredOutput(PatientDetailsSchema);
const intentLlmStructured = llm.withStructuredOutput(z.object({ confirmed: z.boolean().nullable() }));
const conversationalLlm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    temperature: 0.6
});

/**
 * Infers what field the assistant last asked the user about,
 * by scanning the most recent AI message for field-related keywords.
 */
const inferLastAskedField = (messages: any[]): string | undefined => {
    // Walk backwards through messages to find the last AI message
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        // AIMessage type check — LangChain sets _getType() = "ai"
        const isAI = msg._getType?.() === "ai" || msg.constructor?.name === "AIMessage";
        if (!isAI) continue;

        const text: string = typeof msg.content === "string"
            ? msg.content.toLowerCase()
            : JSON.stringify(msg.content).toLowerCase();

        // Order matters: check most specific patterns first
        if (text.includes("blood group") || text.includes("blood type")) return "blood_group";
        if (text.includes("weight")) return "weight";
        if (text.includes("height")) return "height";
        if (
            text.includes("symptom") ||
            text.includes("reason for visit") ||
            text.includes("description") ||
            text.includes("brief description")
        ) return "description";

        break; // Only check the most recent AI message
    }
    return undefined;
};

const extractorNode = async (state: typeof AgentState.State) => {
    // Look at last 10 messages for context
    const recentMessages = state.messages.slice(-10);

    // Determine what field the assistant last asked for (gives extractor context)
    const lastAskedField = inferLastAskedField(state.messages.slice(0, -1)); // exclude latest human msg

    // 1. Determine if we need intent extraction (only when all fields collected)
    const required = ["description", "height", "weight", "blood_group"];
    const tentativeCombined = { ...state.collected_data }; // will refine after extraction
    const allPresentBefore = required.every(field => (state.collected_data as any)[field]);

    // 2. Run extraction — always. Run intent in parallel IF all fields were already present.
    //    This avoids a sequential double-LLM-call and cuts latency roughly in half.
    const extractionPromise = extractionLlmStructured.invoke([
        getExtractionPrompt(lastAskedField),
        ...recentMessages
    ]);

    const intentPromise = allPresentBefore
        ? intentLlmStructured.invoke([getIntentExtractionPrompt(), ...recentMessages])
        : Promise.resolve(null);

    const [extracted, intentResult] = await Promise.all([extractionPromise, intentPromise]);

    const cleaned = cleanExtractedData(extracted);

    // --- RANGE VALIDATION ---
    // Strip out-of-range numeric values so they don't enter collected_data.
    // Track them in invalid_fields so the responder can give a specific error.
    const RANGES: Record<string, { min: number; max: number; unit: string; example: string }> = {
        height: { min: 30, max: 300, unit: "cm", example: "e.g. 170 cm or 5 ft 7 in" },
        weight: { min: 2,  max: 300, unit: "kg", example: "e.g. 65 kg or 143 lbs" },
    };

    const invalidFields: Record<string, number> = {};
    for (const [field, range] of Object.entries(RANGES)) {
        const val = (cleaned as any)[field];
        if (val !== null && val !== undefined) {
            if (val < range.min || val > range.max) {
                invalidFields[field] = val;      // remember the bad value
                (cleaned as any)[field] = null;  // do NOT store it in collected_data
            }
        }
    }

    // Merge to get the full picture after this turn
    const mergedData = { ...state.collected_data, ...cleaned };

    // Identify what was newly added vs updated
    const newlyExtracted = Object.keys(cleaned).filter(key => !(state.collected_data as any)[key]);
    const updatedFields = Object.keys(cleaned).filter(key =>
        (state.collected_data as any)[key] && (state.collected_data as any)[key] !== (cleaned as any)[key]
    );

    // 3. If all required fields are now present (after extraction), run intent if we didn't above
    const allPresentNow = required.every(field => (mergedData as any)[field]);

    let intentResultFinal = intentResult;
    if (!allPresentBefore && allPresentNow && intentResultFinal === null) {
        // All fields were just completed this turn — check for immediate confirmation in same message
        intentResultFinal = await intentLlmStructured.invoke([
            getIntentExtractionPrompt(),
            ...recentMessages
        ]);
    }

    let isConfirmed = state.is_confirmed;
    let detailsShown = state.details_shown;

    // Reset confirmation and details shown if user updated something
    if (updatedFields.length > 0) {
        isConfirmed = false;
        detailsShown = false;
    }

    if (intentResultFinal) {
        if (intentResultFinal.confirmed === true) isConfirmed = true;
        if (intentResultFinal.confirmed === false) {
            isConfirmed = false;
            detailsShown = false;
        }
    }

    return {
        collected_data: cleaned,
        newly_extracted_fields: newlyExtracted,
        updated_fields: updatedFields,
        is_confirmed: isConfirmed,
        details_shown: detailsShown,
        last_asked_field: lastAskedField,
        invalid_fields: invalidFields,
    };
};

const validatorNode = async (state: typeof AgentState.State) => {
    const required = ["description", "height", "weight", "blood_group"];
    const currentData = state.collected_data;
    const missing = required.filter(field => !(currentData as any)[field]);
    return { missing_fields: missing };
};

const responderNode = async (state: typeof AgentState.State) => {
    const recentMessages = state.messages.slice(-10);
    const prompt = getConversationalPrompt(
        state.missing_fields,
        state.newly_extracted_fields,
        state.updated_fields,
        state.is_confirmed,
        state.collected_data,
        state.details_shown,
        (state as any).last_asked_field,
        (state as any).invalid_fields ?? {},
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
            gender: state.booking_context.gender || patient.gender,

            description: state.collected_data.description!,
            height: state.collected_data.height!,
            weight: state.collected_data.weight!,
            blood_group: state.collected_data.blood_group!,
        };

        // 4. Call the strict appointment service
        const bookingResult = await appointmentService.initiateBookingSession({
            userId: state.booking_context.patient_id!,
            body: reqBody,
            files: validFiles,
        });

        return {
            checkout_url: bookingResult.checkoutUrl,
            messages: [new AIMessage("All set! I've prepared your appointment. Please click the button below to complete your payment.")]
        };
    } catch (error: any) {
        return { error: error.message || "Failed to generate appointment." };
    }
};

// --- ROUTING LOGIC ---
const routeAfterValidation = (state: typeof AgentState.State) => {
    if (state.missing_fields.length === 0 && state.is_confirmed) {
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

export const chatBookingGraph = builder.compile({ checkpointer: new MemorySaver() });