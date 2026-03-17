import { z } from 'zod';
import { Gender, BloodType } from '@prisma/client';
import { REGEX } from '../../shared/constants/regex.constants';

export const guestBookingSchema = z.object({
    body: z.object({
        name: z.string()
            .min(2, "Name must be at least 2 characters")
            .regex(REGEX.NAME, "Only alphabets are allowed in name"),
        email: z.string().regex(REGEX.EMAIL, "Invalid email format"),
        phone: z.string().regex(REGEX.PHONE, "Invalid 10-digit Indian phone number"),
        gender: z.nativeEnum(Gender, { message: "Invalid gender" }),
        height: z.preprocess(
            (val) => (val ? parseFloat(String(val)) : undefined),
            z.number().min(30, "Height must be at least 30 cm").max(300, "Height cannot exceed 300 cm")
        ),
        weight: z.preprocess(
            (val) => (val ? parseFloat(String(val)) : undefined),
            z.number().min(2, "Weight must be at least 2 kg").max(500, "Weight cannot exceed 500 kg")
        ),
        blood_group: z.nativeEnum(BloodType, { message: "Invalid blood group" }),
        description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
        reports: z.array(z.object({
            url: z.string().url("Invalid report URL"),
            public_id: z.string().min(1, "Report public_id is required")
        })).optional()
    })
});

export const doctorStatusSchema = z.object({
    params: z.object({
        doctorId: z.string().min(1, "Doctor ID or Token is required")
    })
});

export type IGuestBookingRequest = z.infer<typeof guestBookingSchema>['body'];
