import { z } from 'zod';
import { IndianCity, Gender, BloodType, Specialty } from '@prisma/client';
import { REGEX } from '../../shared/constants/regex.constants';
import { appointment_status } from '../../shared/constants/appointment-status';
import { patient_appointment_tabs } from '../../shared/constants/appointment-tabs';

export const updatePatientProfileSchema = z.object({
    body: z.object({
        // Non-editable fields explicitly rejected
        email: z.string().optional().refine((val) => val === undefined, "email is not editable"),
        gender: z.string().optional().refine((val) => val === undefined, "gender is not editable"),
        dob: z.string().optional().refine((val) => val === undefined, "dob is not editable"),

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
        old_password: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
        new_password: z.preprocess((val) => (val === "" ? undefined : val), z.string().regex(REGEX.PASSWORD, "Password must be at least 8 characters, one uppercase, one lowercase, one number and one special character").min(8, "New password must be at least 8 characters").optional()),
        confirm_new_password: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
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

export const getDoctorsQuerySchema = z.object({
    query: z.object({
        page: z.preprocess((val) => (val ? parseInt(String(val)) : 1), z.number().min(1).default(1)),
        limit: z.preprocess((val) => (val ? parseInt(String(val)) : 4), z.number().min(1).max(50).default(4)),
        search: z.string().optional(),

        // Multi-select enabled filters
        locations: z.union([
            z.nativeEnum(IndianCity).array(),
            z.string().transform((val) => {
                try {
                    const parsed = JSON.parse(val);
                    return Array.isArray(parsed) ? parsed : [val];
                } catch {
                    return [val];
                }
            }).pipe(z.nativeEnum(IndianCity).array())
        ]).optional(),

        genders: z.union([
            z.nativeEnum(Gender).array(),
            z.string().transform((val) => {
                try {
                    const parsed = JSON.parse(val);
                    return Array.isArray(parsed) ? parsed : [val];
                } catch {
                    return [val];
                }
            }).pipe(z.nativeEnum(Gender).array())
        ]).optional(),

        specialties: z.union([
            z.nativeEnum(Specialty).array(),
            z.string().transform((val) => {
                try {
                    const parsed = JSON.parse(val);
                    return Array.isArray(parsed) ? parsed : [val];
                } catch {
                    return [val];
                }
            }).pipe(z.nativeEnum(Specialty).array())
        ]).optional(),

        min_experience: z.preprocess((val) => (val ? parseInt(String(val)) : undefined), z.number().min(0).max(128).optional()),
        min_rating: z.preprocess((val) => (val ? parseFloat(String(val)) : undefined), z.number().min(0).max(5).optional()),
        min_fee: z.preprocess((val) => (val ? parseFloat(String(val)) : undefined), z.number().min(0).max(1000000).optional()),
        max_fee: z.preprocess((val) => (val ? parseFloat(String(val)) : undefined), z.number().min(0).max(1000000).optional()),

        sort_by: z.enum(['name_asc', 'name_desc', 'fee_asc', 'fee_desc']).optional(),
    }),
});

export const getAppointmentsQuerySchema = z.object({
    query: z.object({
        page: z.preprocess((val) => (val ? parseInt(String(val)) : 1), z.number().min(1).default(1)),
        limit: z.preprocess((val) => (val ? parseInt(String(val)) : 4), z.number().min(1).max(50).default(4)),
        tab: z.nativeEnum(patient_appointment_tabs),
        from: z.string().optional(),
        to: z.string().optional(),
        status: z.union([
            z.nativeEnum(appointment_status).array(),
            z.string().transform((val) => {
                try {
                    const parsed = JSON.parse(val);
                    return Array.isArray(parsed) ? parsed : [val];
                } catch {
                    return [val];
                }
            }).pipe(z.nativeEnum(appointment_status).array())
        ]).optional(),
        sort_by: z.enum(['nearest', 'farthest']).default('nearest'),
    }),
}).refine((data) => {
    const { from, to, tab } = data.query;
    if (from && to) {
        return new Date(from) <= new Date(to);
    }
    return true;
}, {
    message: "from date must be before or equal to to date",
    path: ["query", "from"]
}).refine((data) => {
    const { from, tab } = data.query;
    if (tab === 'history' && from) {
        const fromDate = new Date(from);
        const yesterday = new Date();
        yesterday.setHours(0, 0, 0, 0);
        yesterday.setDate(yesterday.getDate() - 1);
        return fromDate <= yesterday;
    }
    return true;
}, {
    message: "History 'from' date cannot be in the future (max value is yesterday)",
    path: ["query", "from"]
});

export const getDoctorAvailabilitySchema = z.object({
    params: z.object({
        doctorId: z.string().uuid("Invalid doctor ID format")
    })
});

export type IUpdatePatientProfile = z.infer<typeof updatePatientProfileSchema>['body'];
export type IGetDoctorsQuery = z.infer<typeof getDoctorsQuerySchema>['query'];
export type IGetAppointmentsQuery = z.infer<typeof getAppointmentsQuerySchema>['query'];
