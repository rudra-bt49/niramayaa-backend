import { Response, Request } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { voiceService } from "./voice.service";
import { BookingContext } from "../chatbot/chatbot.types";
import prisma from "../../../prisma/prisma";

export const voiceController = {
    startCall: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // 1. Extract files exactly like Chatbot
            const files = (req.files as Express.Multer.File[]) || [];
            const patientId = req.user?.userId;

            // 2. Parse booking_context exactly like Chatbot
            let booking_context: BookingContext | undefined;
            if (req.body.booking_context) {
                try {
                    booking_context = typeof req.body.booking_context === 'string' 
                        ? JSON.parse(req.body.booking_context) 
                        : req.body.booking_context;
                    
                    if (booking_context && patientId) {
                        booking_context.patient_id = patientId;
                    }
                } catch (err) {
                    res.status(400).json({ success: false, message: "Invalid booking context format." });
                    return;
                }
            }

            if (!booking_context || !patientId) {
                res.status(400).json({ success: false, message: "Missing required fields." });
                return;
            }

            // 3. Fetch Patient Profile & Phone Number
            const patient = await prisma.user.findUnique({ where: { id: patientId } });

            if (!patient || !patient.phone_number) {
                res.status(400).json({ 
                    success: false, 
                    message: "No phone number found in patient profile. Please update your profile first." 
                });
                return;
            }

            const patientName = booking_context.name || patient.first_name || "Patient";
            const phone = patient.phone_number;

            // 4. Start the call and pass FILES to the service cache
            const callId = await voiceService.startOutboundCall(phone, patientName, booking_context, files);

            res.status(200).json({ success: true, message: "Call initiated successfully", data: { callId } });
            
        } catch (error: any) {
            console.error("Start Call Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    vapiWebhook: async (req: Request, res: Response): Promise<void> => {
        try {
            const message = req.body.message;

            if (message && message.type === "end-of-call-report") {
                const callId = message.call.id;
                const structuredData = message.analysis?.structuredData || {};
                const callStatus = message.endedReason; 

                // Process booking in the background
                voiceService.handleEndOfCallReport(callId, structuredData, callStatus);
            }

            res.status(200).json({ received: true });
        } catch (error: any) {
            console.error("Vapi Webhook Error:", error);
            res.status(500).json({ received: false, error: error.message });
        }
    }
};