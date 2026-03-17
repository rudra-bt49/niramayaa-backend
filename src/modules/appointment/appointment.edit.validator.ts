import { z } from 'zod';

export const updateMedicalReportsSchema = z.object({
    appointmentId: z.string().uuid({ message: "Invalid appointment ID" }),
    existing_reports: z.string().optional().transform((val) => {
        if (!val) return [];
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    })
});
