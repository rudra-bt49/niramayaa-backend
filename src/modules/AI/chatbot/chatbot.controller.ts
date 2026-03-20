import { Response } from 'express';
import { chatBookingService } from './chatbot.service';
import { BookingContext } from './chatbot.types';
import { AuthRequest } from '../../../middlewares/auth.middleware'; 

export const chatController = async (req: AuthRequest, res: Response): Promise<void> => {
    // 1. Ensure files defaults to an empty array if undefined
    const files = (req.files as Express.Multer.File[]) || [];
    
    const { thread_id, message } = req.body;
    
    // 2. Extract patient_id securely from the auth token
    const patient_id = req.user?.userId;

    let booking_context: BookingContext | undefined;
    
    if (req.body.booking_context) {
        try {
            booking_context = typeof req.body.booking_context === 'string' 
                ? JSON.parse(req.body.booking_context) 
                : req.body.booking_context;
            
            // 3. Inject the secure patient_id into the context on the first turn
            if (booking_context && patient_id) {
                booking_context.patient_id = patient_id;
            }
            
        } catch (err) {
            console.error("Failed to parse booking_context:", err);
        }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const stream = chatBookingService.processChatInteraction(
            thread_id, 
            message, 
            booking_context, 
            files
        );

        for await (const event of stream) {
            sendEvent(event.type, event.data);
        }

        res.write('event: done\ndata: {}\n\n');
        res.end();

    } catch (error: any) {
        console.error("Chat Controller Error:", error);
        sendEvent("error", { text: "An internal server error occurred." });
        res.end();
    }
};