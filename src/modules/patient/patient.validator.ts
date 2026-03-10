import { z } from 'zod';
import { IndianCity, Gender, BloodType } from '@prisma/client';
import { REGEX } from '../../shared/constants/regex.constants';

export const updatePatientProfileSchema = z.object({
    body: z.object({
        // Non-editable fields explicitly rejected
        email: z.any().refine((val) => val === undefined, "email is not editable").optional(),
        gender: z.any().refine((val) => val === undefined, "gender is not editable").optional(),
        dob: z.any().refine((val) => val === undefined, "dob is not editable").optional(),

        first_name: z.string().regex(REGEX.NAME, "Only alphabets are allowed in first name").min(2, "First name must be at least 2 characters").optional(),
        last_name: z.string().regex(REGEX.NAME, "Only alphabets are allowed in last name").min(2, "Last name must be at least 2 characters").optional(),
        phone_number: z.string().regex(REGEX.PHONE, "Invalid phone number format. Must be 10 digits").optional(),
        city: z.nativeEnum(IndianCity).optional(),

        // Height in cm
        height: z.preprocess((val) => (val ? parseFloat(String(val)) : undefined), z.number().min(30).max(300).optional()),
        
        // Weight in kg
        weight: z.preprocess((val) => (val ? parseFloat(String(val)) : undefined), z.number().min(2).max(500).optional()),
        
        blood_group: z.nativeEnum(BloodType).optional(),
        allergies: z.preprocess((val) => (val === "" ? undefined : val), z.string()
            .trim()
            .max(200, "Allergies cannot exceed 200 characters")
            .regex(REGEX.ALLERGIES, "Allergies can only contain letters, spaces, and commas")
            .refine((val) => {
                const items = val.split(",").map(a => a.trim());
                return items.every(a => a.length >= 2);
            }, "Each allergy must be at least 2 characters")
            .optional()),
        emergency_contact_name: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
        emergency_contact_phone: z.preprocess((val) => (val === "" ? undefined : val), z.string().regex(REGEX.PHONE, "Invalid emergency phone number format. Must be 10 digits").optional()),

        // Password reset block
        old_password: z.string().optional(),
        new_password: z.string().regex(REGEX.PASSWORD, "Password must be at least 8 characters, one uppercase, one lowercase, one number and one special character").min(8, "New password must be at least 8 characters").optional(),
        confirm_new_password: z.string().optional(),
    }).refine((data) => {
        if (data.new_password || data.confirm_new_password) {
            return data.new_password === data.confirm_new_password;
        }
        return true;
    }, {
        message: "New passwords do not match",
        path: ["confirm_new_password"],
    }).refine((data) => {
        if (data.new_password && !data.old_password) {
            return false;
        }
        return true;
    }, {
        message: "Old password is required to set a new password",
        path: ["old_password"],
    }),
});

export type IUpdatePatientProfile = z.infer<typeof updatePatientProfileSchema>['body'];
