import { BookingContext } from "../chatbot/chatbot.types";
import { appointmentService } from "../../appointment/appointment.service";
import { getVoiceAgentPrompt } from "./voice.prompt";
import prisma from "../../../prisma/prisma";

// Cache BOTH the context and the uploaded files during the call
interface CallCacheData {
    context: BookingContext;
    files: Express.Multer.File[];
}

const callContextCache = new Map<string, CallCacheData>();

export const voiceService = {
    startOutboundCall: async (
        phone: string, 
        patientName: string, 
        context: BookingContext, 
        files: Express.Multer.File[]
    ) => {
        const VAPI_API_KEY = process.env.VAPI_API_KEY;
        const PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

        if (!VAPI_API_KEY || !PHONE_NUMBER_ID) {
            throw new Error("Missing Vapi environment variables");
        }

        const payload = {
            phoneNumberId: PHONE_NUMBER_ID,
            customer: { number: phone, name: patientName },
            assistant: {
                name: "Niramayaa Booking Assistant",
                serverUrl : `${process.env.SERVER_URL}/payments/vapi-webhook`,
                firstMessage: `Hello ${patientName}, I am calling to finalize your appointment booking. Can you briefly describe your symptoms?`,
                model: {
                    provider: "openai",
                    model: "gpt-4o-mini",
                    messages: [{ role: "system", content: getVoiceAgentPrompt(patientName) }]
                },
                voice: { provider: "11labs", voiceId: "paula" },
                endCallFunctionEnabled: true, 
                endCallMessage: "All set! I've prepared your appointment you can do payment from appointment dashboard.",
                endCallPhrases: ["All set! I've prepared your appointment you can do payment from appointment dashboard."],
                maxDurationSeconds: 180, 
                silenceTimeoutSeconds: 15, 
                analysisPlan: {
                    structuredDataPlan: {
                        schema: {
                            type: "object",
                            properties: {
                                symptoms: { type: "string" },
                                height: { type: "number" },
                                weight: { type: "number" },
                                bloodGroup: { 
                                    type: "string", 
                                    enum: ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"] 
                                }
                            },
                            required: ["symptoms", "height", "weight", "bloodGroup"]
                        }
                    }
                }
            }
        };

        // Replaced axios with native fetch
        const response = await fetch("https://api.vapi.ai/call", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${VAPI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        // Fetch requires manual throwing on non-2xx responses
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vapi API Error (${response.status}): ${errorText}`);
        }

        const responseData = (await response.json()) as { id: string };
        const callId = responseData.id;
        
        // Cache both context and files
        callContextCache.set(callId, { context, files });
        
        return callId;
    },

    handleEndOfCallReport: async (callId: string, structuredData: any, callStatus: string) => {
        const cachedData = callContextCache.get(callId);
        if (!cachedData) return;
        
        // Clean up cache immediately to free memory
        callContextCache.delete(callId); 

        const { context, files } = cachedData;

        console.log(`Analyzing Voice Booking for Call ${callId}. Status: ${callStatus}`);

        if (!structuredData.symptoms || !structuredData.height || !structuredData.weight || !structuredData.bloodGroup) {
            console.error(`❌ Call ${callId} failed validation. Missing required fields.`);
            return;
        }

        try {
            // Fetch profile exactly like chatbot to fill missing data
            const patient = await prisma.user.findUnique({ where: { id: context.patient_id! } });
            
            if (!patient) throw new Error("Patient not found in database.");

            // Build request body with database fallbacks
            const reqBody = {
                doctor_id: context.doctor_id!,
                start_at: context.start_at!,
                end_at: context.end_at!,
                
                // Fallbacks from profile
                name: context.name || `${patient.first_name} ${patient.last_name}`,
                email: context.email || patient.email || "",
                phone: context.phone || patient.phone_number || "",
                gender: context.gender || patient.gender as any,
                
                // Extracted from voice AI
                description: structuredData.symptoms,
                height: Number(structuredData.height),
                weight: Number(structuredData.weight),
                blood_group: structuredData.bloodGroup,
                
                // Append the call details
                call_id: callId, 
                call_status: "COMPLETED" 
            };

            // Hit the appointment service perfectly
            const bookingResult = await appointmentService.initiateBookingSession({
                userId: context.patient_id!,
                body: reqBody as any, 
                files: files, // Pass the cached files here
            });

            console.log(`✅ Voice Booking Success! Link: ${bookingResult.checkoutUrl}`);

        } catch (error) {
            console.error(`❌ Failed to process booking from voice call ${callId}:`, error);
        }
    }
};

// VOICE_CALL:'/patients/voice/start',
//         VAPI_WEBHOOK:'/payments/vapi-webhook'

//   call_id       String?
//   call_status   String?