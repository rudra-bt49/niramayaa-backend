import { z } from 'zod';
import { Gender, BloodType } from '@prisma/client';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24-hour format

export const bookAppointmentSchema = z.object({
    body: z.object({
        doctor_id: z.string().uuid("Invalid doctor_id"),
        start_at: z.string().datetime("Invalid start_at format. Use ISO string"),
        end_at: z.string().datetime("Invalid end_at format. Use ISO string"),
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
            const startDate = new Date(data.start_at);
            const endDate = new Date(data.end_at);

            if (startDate.getTime() >= endDate.getTime()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "start_at must be before end_at",
                    path: ['start_at'],
                });
            }
        })
});
