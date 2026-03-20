import { BookingContext } from "../chatbot/chatbot.types";
import { appointmentService } from "../../appointment/appointment.service";
import { getVoiceAgentPrompt } from "./voice.prompt";
import prisma from "../../../prisma/prisma";
import { cloudinaryService } from "../../../shared/services/cloudinary.service";

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

        // 1. UPLOAD FILES EARLY (Stateless Fix)
        const uploadedReports: { secure_url: string; public_id: string }[] = [];
        if (files && files.length > 0) {
            console.log(`📡 Uploading ${files.length} reports for ${patientName} before call starts...`);
            for (const file of files) {
                try {
                    const result = await cloudinaryService.uploadImageStream(file.buffer, 'medical_reports');
                    uploadedReports.push(result);
                } catch (error) {
                    console.error('File upload failed during start-call', error);
                }
            }
        }

        // 2. Add the uploaded reports to the context for Vapi to hold
        const statelessMetadata = {
            ...context,
            uploaded_reports: uploadedReports
        };

        const payload = {
            phoneNumberId: PHONE_NUMBER_ID,
            customer: { number: phone, name: patientName },
            // Attach metadata to the call itself
            metadata: statelessMetadata, 
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

        const response = await fetch("https://api.vapi.ai/call", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${VAPI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vapi API Error (${response.status}): ${errorText}`);
        }

        const responseData = (await response.json()) as { id: string };
        return responseData.id;
    },

    handleEndOfCallReport: async (callId: string, metadata: any, structuredData: any, callStatus: string) => {
        if (!metadata || !metadata.patient_id) {
            console.error(`❌ Call ${callId} failed. No metadata found (Stateless Data Missing).`);
            return;
        }

        const context = metadata as BookingContext & { uploaded_reports?: { secure_url: string; public_id: string }[] };

        console.log(`Analyzing Voice Booking for Call ${callId}. Status: ${callStatus}`);

        if (!structuredData.symptoms || !structuredData.height || !structuredData.weight || !structuredData.bloodGroup) {
            console.warn(`⚠️ Call ${callId} missing some symptoms or vitals, but proceeding with available info.`);
        }

        try {
            const patient = await prisma.user.findUnique({ where: { id: context.patient_id! } });
            if (!patient) throw new Error("Patient not found in database.");

            const reqBody = {
                doctor_id: context.doctor_id!,
                start_at: context.start_at!,
                end_at: context.end_at!,
                
                name: context.name || `${patient.first_name} ${patient.last_name}`,
                email: context.email || patient.email || "",
                phone: context.phone || patient.phone_number || "",
                gender: context.gender || patient.gender as any,
                
                description: structuredData.symptoms || "Booked via voice Assistant",
                height: structuredData.height ? Number(structuredData.height) : 0,
                weight: structuredData.weight ? Number(structuredData.weight) : 0,
                blood_group: structuredData.bloodGroup || "O_POS",
                
                call_id: callId, 
                call_status: "COMPLETED" 
            };

            const bookingResult = await appointmentService.initiateBookingSession({
                userId: context.patient_id!,
                body: reqBody as any, 
                files: [], // Files were uploaded early
                uploadedReports: context.uploaded_reports // Pass pre-uploaded reports
            });

            console.log(`✅ Voice Booking Success! Session: ${bookingResult.checkoutUrl}`);

        } catch (error) {
            console.error(`❌ Failed to process booking from voice call ${callId}:`, error);
        }
    }
};

// VOICE_CALL:'/patients/voice/start',
//         VAPI_WEBHOOK:'/payments/vapi-webhook'

//   call_id       String?
//   call_status   String?