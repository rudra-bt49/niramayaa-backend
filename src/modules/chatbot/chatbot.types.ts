import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import { BloodType, Gender } from "@prisma/client";

// Export the Zod Schema (Fixes Error 2305 & 2304)
export const PatientDetailsSchema = z.object({
    description: z.string().nullish().describe("Patient's symptoms or reason for visit."),
    height: z.number().min(30).max(300).nullish().describe("Patient's height strictly in centimeters. Convert feet/inches to cm."),
    weight: z.number().min(2).max(500).nullish().describe("Patient's weight strictly in kilograms. Convert lbs to kg."),
    blood_group: z.nativeEnum(BloodType).nullish().describe("Strictly one of: A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG."),
});

// Export the Type (Fixes Error in util.ts)
export type ExtractedPatientDetails = z.infer<typeof PatientDetailsSchema>;

export interface BookingContext {
    patient_id?: string;
    doctor_id?: string;
    start_at?: string;
    end_at?: string;
    name?: string;
    email?: string;
    phone?: string;
    gender?: Gender;
}

export const AgentState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    booking_context: Annotation<BookingContext>({
        reducer: (state, update) => ({ ...state, ...(update || {}) }),
        default: () => ({} as BookingContext),
    }),
    collected_data: Annotation<Partial<ExtractedPatientDetails>>({
        reducer: (state, update) => ({ ...state, ...(update || {}) }), 
        default: () => ({}),
    }),
    missing_fields: Annotation<string[]>({
        reducer: (x, y) => y,
        default: () => ["description", "height", "weight", "blood_group"],
    }),
    files: Annotation<Express.Multer.File[]>({
        reducer: (existingFiles, newFiles) => {
            const combinedFiles = [...existingFiles, ...(newFiles || [])];
            
            // Deduplicate based on the file's original name
            const uniqueFilesMap = new Map();
            combinedFiles.forEach(file => {
                // If we haven't seen this file name yet, add it to the map
                if (!uniqueFilesMap.has(file.originalname)) {
                    uniqueFilesMap.set(file.originalname, file);
                }
            });
            
            // Convert the map values back to an array
            return Array.from(uniqueFilesMap.values());
        },
        default: () => [],
    }),
    checkout_url: Annotation<string | undefined>({
        reducer: (x, y) => y ?? x,
        default: () => undefined,
    }),
    error: Annotation<string | undefined>({
        reducer: (x, y) => y ?? x,
        default: () => undefined,
    }),
});