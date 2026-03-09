import { z } from 'zod';
import { IndianCity, Specialty, Qualification } from '@prisma/client';
import { REGEX } from '../../shared/constants/regex.constants';

export const updateDoctorProfileSchema = z.object({
    body: z.object({
        // Non-editable fields explicitly rejected
        email: z.any().refine((val) => val === undefined, "email is not editable").optional(),
        gender: z.any().refine((val) => val === undefined, "gender is not editable").optional(),
        dob: z.any().refine((val) => val === undefined, "dob is not editable").optional(),
        plan_id: z.any().refine((val) => val === undefined, "plan_id is not editable").optional(),
        plan_name: z.any().refine((val) => val === undefined, "plan_name is not editable").optional(),
        plan_expires_at: z.any().refine((val) => val === undefined, "plan_expires_at is not editable").optional(),

        first_name: z.string().regex(REGEX.NAME, "Only alphabets are allowed in first name").min(2, "First name must be at least 2 characters").optional(),
        last_name: z.string().regex(REGEX.NAME, "Only alphabets are allowed in last name").min(2, "Last name must be at least 2 characters").optional(),
        phone_number: z.string().regex(REGEX.PHONE, "Invalid phone number format. Must be 10 digits").optional(),
        city: z.nativeEnum(IndianCity).optional(),

        bio: z.string().optional(),
        specialties: z.union([z.nativeEnum(Specialty).array().min(1, "At least one specialty is required"), z.string().transform((val) => {
            try { return JSON.parse(val); } catch { return [val]; }
        })]).optional(),
        experience: z.preprocess((val) => (val ? parseInt(String(val)) : undefined), z.number().min(0).max(128).optional()),
        qualifications: z.union([z.nativeEnum(Qualification).array().min(1, "At least one qualification is required"), z.string().transform((val) => {
            try { return JSON.parse(val); } catch { return [val]; }
        })]).optional(),
        consultation_fee: z.preprocess((val) => (val ? parseFloat(String(val)) : undefined), z.number().min(10).max(1000000).optional()),

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

export type IUpdateDoctorProfile = z.infer<typeof updateDoctorProfileSchema>['body'];
