import { StateGraph, MemorySaver } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { AIMessage } from "@langchain/core/messages";
import { AgentState, PatientDetailsSchema } from "./chatbot.types";
import { getExtractionPrompt, getConversationalPrompt } from "./chatbot.prompts";
import { cleanExtractedData } from "./chatbot.util";
import { appointmentService } from "../appointment/appointment.service";
import prisma from "../../prisma/prisma"; 

const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-20b", 
    temperature: 0, 
});

const extractionLlm = llm.withStructuredOutput(PatientDetailsSchema);
const conversationalLlm = new ChatGroq({ 
    apiKey: process.env.GROQ_API_KEY, 
    model: "openai/gpt-oss-120b", 
    temperature: 0.6 
});
// --- NODES ---

const extractorNode = async (state: typeof AgentState.State) => {
    // Look at last 10 messages for context as requested
    const recentMessages = state.messages.slice(-10);
    const extracted = await extractionLlm.invoke([getExtractionPrompt(), ...recentMessages]);
    return { collected_data: cleanExtractedData(extracted) };
};

const validatorNode = async (state: typeof AgentState.State) => {
    const required = ["description", "height", "weight", "blood_group"];
    const currentData = state.collected_data;
    const missing = required.filter(field => !(currentData as any)[field]);
    return { missing_fields: missing };
};

const responderNode = async (state: typeof AgentState.State) => {
    const recentMessages = state.messages.slice(-10);
    const prompt = getConversationalPrompt(state.missing_fields);
    const response = await conversationalLlm.invoke([prompt, ...recentMessages]);
    return { messages: [response] };
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
            messages: [new AIMessage("All set! I've prepared your appointment. Please click the button below to complete your payment.")]
        };
    } catch (error: any) {
        return { error: error.message || "Failed to generate appointment." };
    }
};

// --- ROUTING LOGIC ---
const routeAfterValidation = (state: typeof AgentState.State) => {
    if (state.missing_fields.length === 0) return "booker";
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