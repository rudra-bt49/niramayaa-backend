import { z } from "zod";
import { Gender, IndianCity, Qualification, Specialty } from "@prisma/client";
import { REGEX } from "../../shared/constants/regex.constants";

export const patientSignupSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format"),
        first_name: z.string()
            .min(2, "First name must be at least 2 characters")
            .regex(REGEX.NAME, "Only alphabets are allowed in first name"),
        last_name: z.string()
            .min(2, "Last name must be at least 2 characters")
            .regex(REGEX.NAME, "Only alphabets are allowed in last name"),
        phone_number: z.string()
            .regex(REGEX.PHONE, "Invalid 10-digit Indian phone number"),
        password: z.string()
            .regex(REGEX.PASSWORD, "Password must be at least 8 characters, one uppercase, one lowercase, one number and one special character"),
        gender: z.nativeEnum(Gender, { message: "Invalid gender" }),
        city: z.nativeEnum(IndianCity, { message: "Invalid city" }),
        dob: z.string().refine((val) => {
            const birthDate = new Date(val);
            const today = new Date();
            return birthDate < today;
        }, "Date of birth cannot be in the future"),
        verification_token: z.string().min(1, "Verification token is required"),
    }),
});
export const loginSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format"),
        password: z.string().min(1, "Password is required"),
        forceLogout: z.boolean().optional(),
    }),
});

export const sendOtpSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format"),
    }),
});

export const verifyOtpSchema = z.object({
    body: z.object({
        token: z.string().min(1, "Token is required"),
        otp: z.string().length(6, "OTP must be 6 digits"),
    }),
});

export const doctorSignupSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format"),
        first_name: z.string()
            .min(2, "First name must be at least 2 characters")
            .regex(REGEX.NAME, "Only alphabets are allowed in first name"),
        last_name: z.string()
            .min(2, "Last name must be at least 2 characters")
            .regex(REGEX.NAME, "Only alphabets are allowed in last name"),
        phone_number: z.string()
            .regex(REGEX.PHONE, "Invalid 10-digit Indian phone number"),
        password: z.string()
            .regex(REGEX.PASSWORD, "Password must be at least 8 characters, one uppercase, one lowercase, one number and one special character"),
        gender: z.nativeEnum(Gender, { message: "Invalid gender" }),
        city: z.nativeEnum(IndianCity, { message: "Invalid city" }),
        dob: z.string().refine((val) => {
            const birthDate = new Date(val);
            const today = new Date();
            return birthDate < today;
        }, "Date of birth cannot be in the future"),
        // Doctor specific
        qualifications: z.array(z.nativeEnum(Qualification)).min(1, "At least one qualification is required"),
        experience: z.number().min(0, "Experience cannot be negative"),
        specialties: z.array(z.nativeEnum(Specialty)).min(1, "At least one specialty is required"),
        consultation_fee: z.number().min(0, "Fee cannot be negative"),
        plan_name: z.enum(["ELITE", "PRO"], { message: "Invalid plan name" }),
        verification_token: z.string().min(1, "Verification token is required"),
    }),
});
