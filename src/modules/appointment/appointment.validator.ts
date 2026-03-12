import { z } from 'zod';
import { Gender, BloodType } from '@prisma/client';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24-hour format

export const bookAppointmentSchema = z.object({
    body: z.object({
        doctor_id: z.string().uuid("Invalid doctor_id"),
        availability_id: z.string().uuid("Invalid availability_id"),
        start_at: z.string().regex(timeRegex, "Invalid start_at format. Use HH:MM in 24-hour format"),
        end_at: z.string().regex(timeRegex, "Invalid end_at format. Use HH:MM in 24-hour format"),
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email format"),
        phone: z.string().min(10, "Phone number must be at least 10 characters"),
        height: z.coerce.number().positive("Height must be positive"),
        weight: z.coerce.number().positive("Weight must be positive"),
        gender: z.nativeEnum(Gender),
        blood_group: z.nativeEnum(BloodType),
        description: z.string().optional(),
    }).strict()
        .superRefine((data, ctx) => {
            const parseTime = (timeStr: string) => {
                const [hours, minutes] = timeStr.split(':').map(Number);
                return hours * 60 + minutes; // returns total minutes from midnight
            };

            const startMins = parseTime(data.start_at);
            const endMins = parseTime(data.end_at);

            if (startMins >= endMins) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "start_at must be before end_at",
                    path: ['start_at'],
                });
            }
        })
});
