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
        gender: z.preprocess(
            (val) => (val && typeof val === 'string' ? val.trim().toUpperCase() : val),
            z.nativeEnum(Gender, { message: "Invalid gender. Please use MALE or FEMALE. Also, check if you have a trailing space in your Postman key!" })
        ),
        height: z.preprocess(
            (val) => {
                const n = Number(val);
                return (val === '' || val === undefined || val === null || isNaN(n) ? undefined : n);
            }, 
            z.number({ message: "Height must be a number" })
                .min(30, "Height must be at least 30 cm")
                .max(300, "Height cannot exceed 300 cm")
        ),
        weight: z.preprocess(
            (val) => {
                const n = Number(val);
                return (val === '' || val === undefined || val === null || isNaN(n) ? undefined : n);
            }, 
            z.number({ message: "Weight must be a number" })
                .min(2, "Weight must be at least 2 kg")
                .max(500, "Weight cannot exceed 500 kg")
        ),
        blood_group: z.preprocess(
            (val) => (val && typeof val === 'string' ? val.trim().toUpperCase().replace(/\s+/g, '_') : val),
            z.nativeEnum(BloodType, { message: "Invalid blood group" })
        ),
        description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
        reports: z.preprocess((val) => {
            if (typeof val === 'string' && val.trim() !== '') {
                try { return JSON.parse(val); } catch { return []; }
            }
            return val || [];
        }, z.array(z.object({
            url: z.string().url("Invalid report URL"),
            public_id: z.string().min(1, "Report public_id is required")
        })).optional().nullable().default([]))
    })
});

export const doctorStatusSchema = z.object({
    params: z.object({
        doctorId: z.string().min(1, "Doctor ID or Token is required")
    })
});

export type IGuestBookingRequest = z.infer<typeof guestBookingSchema>['body'];
