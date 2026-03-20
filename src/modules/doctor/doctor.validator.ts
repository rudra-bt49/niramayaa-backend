import { z } from 'zod';
import { IndianCity, Specialty, Qualification, AppointmentStatus } from '@prisma/client';
import { REGEX } from '../../shared/constants/regex.constants';
import { doctor_appointment_tabs } from '../../shared/constants/appointment-tabs';

export const updateDoctorProfileSchema = z.object({
    body: z.object({
        // Non-editable fields explicitly rejected
        email: z.string().optional().refine((val) => val === undefined, "email is not editable"),
        gender: z.string().optional().refine((val) => val === undefined, "gender is not editable"),
        dob: z.string().optional().refine((val) => val === undefined, "dob is not editable"),
        plan_id: z.string().optional().refine((val) => val === undefined, "plan_id is not editable"),
        plan_name: z.string().optional().refine((val) => val === undefined, "plan_name is not editable"),
        plan_expires_at: z.string().optional().refine((val) => val === undefined, "plan_expires_at is not editable"),

        first_name: z.string().regex(REGEX.NAME, "Only alphabets are allowed in first name").min(2, "First name must be at least 2 characters").optional(),
        last_name: z.string().regex(REGEX.NAME, "Only alphabets are allowed in last name").min(2, "Last name must be at least 2 characters").optional(),
        phone_number: z.string().regex(REGEX.PHONE, "Invalid phone number format. Must be 10 digits").optional(),
        city: z.nativeEnum(IndianCity).optional(),

        bio: z.preprocess((val) => (typeof val === 'string' && val.trim() === "" ? undefined : val), z.string().min(20, "Bio must be at least 20 characters").max(500, "Bio must be at most 500 characters").optional()),
        specialties: z.union([z.nativeEnum(Specialty).array().min(1, "At least one specialty is required"), z.string().transform((val) => {
            try { return JSON.parse(val); } catch { return [val]; }
        })]).optional(),
        experience: z.preprocess((val) => (val ? parseInt(String(val)) : undefined), z.number().min(0).max(128).optional()),
        qualifications: z.union([z.nativeEnum(Qualification).array().min(1, "At least one qualification is required"), z.string().transform((val) => {
            try { return JSON.parse(val); } catch { return [val]; }
        })]).optional(),
        consultation_fee: z.preprocess((val) => (val ? parseFloat(String(val)) : undefined), z.number().min(10).max(1000000).optional()),

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

export type IUpdateDoctorProfile = z.infer<typeof updateDoctorProfileSchema>['body'];

export const getAppointmentsQuerySchema = z.object({
    query: z.object({
        page: z.preprocess((val) => (val ? parseInt(String(val)) : 1), z.number().min(1).default(1)),
        limit: z.preprocess((val) => (val ? parseInt(String(val)) : 4), z.number().min(1).default(4)),
        tab: z.nativeEnum(doctor_appointment_tabs),
        from: z.string().optional(),
        to: z.string().optional(),
        status: z.preprocess((val) => {
            if (typeof val === 'string') return [val];
            return val;
        }, z.array(z.nativeEnum(AppointmentStatus)).optional()),
        sort_by: z.enum(['nearest', 'farthest']).default('nearest')
    })
}).refine((data) => {
    const { from, to } = data.query;
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

export type IGetDoctorAppointmentsQuery = z.infer<typeof getAppointmentsQuerySchema>['query'];
