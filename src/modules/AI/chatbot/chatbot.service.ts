import { HumanMessage } from "@langchain/core/messages";
import { chatBookingGraph } from "./chatbot.graph";
import { BookingContext } from "./chatbot.types";

export const chatBookingService = {
    async *processChatInteraction(
        threadId: string, 
        userMessage: string, 
        bookingContext?: BookingContext,
        files?: Express.Multer.File[]
    ) {
        const config = { configurable: { thread_id: threadId } };

        const inputState: any = {
            messages: [new HumanMessage(userMessage)],
        };

        if (bookingContext) inputState.booking_context = bookingContext;
        if (files && files.length > 0) inputState.files = files;

        yield { type: "status", data: { text: "Analyzing your details..." } };

        // Fix 1: Combine the config and streamMode into a single options object
        const stream = await chatBookingGraph.stream(inputState, { 
            ...config, 
            streamMode: "updates" 
        });

        for await (const chunk of stream) {
            if (chunk.extractor) {
                yield { type: "status", data: { text: "Checking what information is still needed..." } };
            } 
            else if (chunk.validator) {
                if (chunk.validator.missing_fields?.length === 0) {
                    yield { type: "status", data: { text: "Generating payment link and booking appointment..." } };
                }
            } 
            else if (chunk.responder) {
                // Safely access the message content
                yield { type: "ai_message", data: { text: chunk.responder.messages?.[0]?.content || "..." } };
            } 
            else if (chunk.booker) {
                if (chunk.booker.error) {
                    // Show error as a visible chat message AND a toast
                    const errText = chunk.booker.messages?.[0]?.content || chunk.booker.error;
                    yield { type: "ai_message", data: { text: errText } };
                } else {
                    yield { 
                        type: "checkout", 
                        data: { 
                            // Fix 2: Use optional chaining to satisfy TypeScript's strict null checks
                            text: chunk.booker.messages?.[0]?.content || "All set! Please complete your payment.",
                            url: chunk.booker.checkout_url 
                        } 
                    };
                }
            }
        }
    }
};