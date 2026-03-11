import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../../prisma/prisma";
import {
    IPatientSignupRequest,
    ILoginRequest,
    ISendVerificationOtpRequest,
    IVerifyOtpRequest,
    IDoctorSignupRequest,
    IForgotPasswordRequest,
    IResetPasswordRequest,
    IValidateSessionRequest,
    IRefreshTokenRequest
} from "./auth.types";
import { UserRole } from "../../shared/constants/roles";
import { tokenUtil } from "../../shared/utils/token.util";
import { ITokenPayload } from "../../types/token.types";
import { sessionService } from "./session.service";
import { stripeService } from "../../shared/services/stripe.service";
import { StripeConfig } from "../../config/stripe.config";
import { hashUtil } from "../../shared/utils/hash.util";
import emailService from "../../shared/services/email.service";
import { doctorService } from "../doctor/doctor.service";

export const authService = {
    sendVerificationOtp: async (data: ISendVerificationOtpRequest) => {
        const { email } = data;

        // 1. Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Generate short-lived token containing OTP and email
        const token = tokenUtil.generateOtpToken({ email, otp });

        // 3. Send OTP via Email
        await emailService.sendVerificationOtpEmail(email, otp).catch(err => {
            console.error(`Failed to send OTP to ${email}:`, err);
        });

        // Log for development
        console.log(`[OTP for ${email}]: ${otp}`);

        return { token };
    },

    verifyOtp: async (data: IVerifyOtpRequest) => {
        const { token, otp: userOtp } = data;

        try {
            // 1. Verify and decode token
            const decoded = tokenUtil.verifyOtpToken(token);

            // 2. Compare OTP
            if (decoded.otp !== userOtp) {
                const error: any = new Error("Invalid OTP");
                error.statusCode = 400;
                throw error;
            }

            // 3. Generate a 20-minute "Successfully Verified" token for signup
            const verification_token = tokenUtil.generateVerificationToken({ email: decoded.email });

            return { verification_token };
        } catch (error: any) {
            if (error.name === "TokenExpiredError") {
                const err: any = new Error("OTP has expired");
                err.statusCode = 400;
                throw err;
            }
            const err: any = new Error(error.message || "Verification failed");
            err.statusCode = error.statusCode || 400;
            throw err;
        }
    },

    patientSignup: async (data: IPatientSignupRequest, deviceId?: string, deviceName?: string) => {
        const { email, first_name, last_name, phone_number, password, gender, city, dob, verification_token } = data;

        // 0. Verify the "Success Hall Pass" token
        try {
            const decoded = tokenUtil.verifyVerificationToken(verification_token);
            if (!decoded.isVerified || decoded.email !== email) {
                const error: any = new Error("Email verification failed or email mismatch");
                error.statusCode = 400;
                throw error;
            }
        } catch (error: any) {
            const err: any = new Error("Invalid or expired verification token. Please verify your email again.");
            err.statusCode = 400;
            throw err;
        }

        // 1. Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            const error: any = new Error("User with this email already exists");
            error.statusCode = 400;
            throw error;
        }

        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // 3. Get Patient Role
        const patientRole = await prisma.role.findUnique({
            where: { name: UserRole.PATIENT },
        });

        if (!patientRole) {
            throw new Error(`Internal Server Error: ${UserRole.PATIENT} role not found`);
        }

        // 4. Create User and Patient Profile in Transaction
        const newUser = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password_hash,
                    first_name,
                    last_name,
                    phone_number: `+91${phone_number}`, // Consistent with frontend
                    gender,
                    city,
                    dob: new Date(dob),
                    role_id: patientRole.id,
                    patient_profile: {
                        create: {},
                    },
                },
                include: {
                    role: true,
                    patient_profile: true,
                },
            });

            return user;
        });

        // 5. Generate Tokens
        const payload = {
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role.name,
        };

        const accessToken = tokenUtil.generateAccessToken(payload);
        const refreshToken = tokenUtil.generateRefreshToken(payload);

        // 6. Create Session
        await sessionService.createSession(newUser.id, refreshToken, deviceId, deviceName);

        return {
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role.name,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
            },
            accessToken,
            refreshToken,
        };
    },

    doctorSignup: async (data: IDoctorSignupRequest) => {
        const { email, first_name, last_name, phone_number, password, gender, city, dob, qualifications, experience, specialties, consultation_fee, plan_name, verification_token } = data;

        // 0. Verify the "Success Hall Pass" token
        try {
            const decoded = tokenUtil.verifyVerificationToken(verification_token);
            if (!decoded.isVerified || decoded.email !== email) {
                const error: any = new Error("Email verification failed or email mismatch");
                error.statusCode = 400;
                throw error;
            }
        } catch (error: any) {
            const err: any = new Error("Invalid or expired verification token. Please verify your email again.");
            err.statusCode = 400;
            throw err;
        }

        // 1. Check if user exists (to prevent duplicate starts)
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            const error: any = new Error("User with this email already exists");
            error.statusCode = 400;
            throw error;
        }

        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // 3. Find the Plan
        const plan = await prisma.doctor_plan.findUnique({
            where: { plan_name: plan_name },
        });

        if (!plan) {
            const error: any = new Error(`Invalid plan: ${plan_name}`);
            error.statusCode = 400;
            throw error;
        }

        // 4. Create Stripe Checkout Session with full data in metadata
        // Stripe metadata has a 500 character limit per key, so we store logically.
        const session = await stripeService.createCheckoutSession({
            doctorEmail: email,
            planName: plan.plan_name,
            amount: plan.amount,
            successUrl: `${StripeConfig.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: StripeConfig.CANCEL_URL,
            metadata: {
                email,
                first_name,
                last_name,
                phone_number: `+91${phone_number}`,
                password_hash,
                gender,
                city,
                dob,
                qualifications: JSON.stringify(qualifications),
                experience: experience.toString(),
                specialties: JSON.stringify(specialties),
                consultation_fee: consultation_fee.toString(),
                plan_name: plan.plan_name,
                registration_type: 'DOCTOR_SIGNUP'
            },
        });

        return {
            sessionId: session.id,
            sessionUrl: session.url,
        };
    },

    verifyDoctorPaymentSession: async (sessionId: string, deviceId?: string, deviceName?: string) => {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is missing');
        }

        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            const error: any = new Error("Payment not completed yet.");
            error.statusCode = 400;
            throw error;
        }

        const email = session.metadata?.email;
        if (!email) throw new Error("Email not found in session metadata");

        // The user was created by the Webhook
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                role: true,
                doctor_profile: {
                    include: { plan: true }
                }
            }
        });

        if (!user) {
            const error: any = new Error("Registration in progress. Please wait a moment and try again.");
            error.statusCode = 404;
            throw error;
        }

        // Generate tokens
        const payload: { userId: string; email: string; role: string; plan_name?: string } = {
            userId: user.id,
            email: user.email,
            role: user.role.name,
        };

        if (user.role.name === UserRole.DOCTOR && user.doctor_profile?.plan?.plan_name) {
            payload.plan_name = user.doctor_profile.plan.plan_name;
        }

        const accessToken = tokenUtil.generateAccessToken(payload);
        const refreshToken = tokenUtil.generateRefreshToken(payload);

        // Create default 30-day availability
        await doctorService.createDefaultAvailability(user.id);

        // Store session
        await sessionService.createSession(user.id, refreshToken, deviceId, deviceName);

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role.name,
                first_name: user.first_name,
                last_name: user.last_name,
            },
            accessToken,
            refreshToken,
        };
    },

    login: async (data: ILoginRequest, deviceId?: string, deviceName?: string) => {
        const { email, password, forceLogout } = data;

        // 1. Find User
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                role: true,
                doctor_profile: {
                    include: { plan: true }
                }
            },
        });

        if (!user) {
            const error: any = new Error("Invalid email or password");
            error.statusCode = 401;
            throw error;
        }

        // 2. Verify Password
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
            const error: any = new Error("Invalid email or password");
            error.statusCode = 401;
            throw error;
        }

        // 3. Single Device Check
        const hasActiveSession = await sessionService.hasActiveSession(user.id);
        if (hasActiveSession && !forceLogout) {
            const error: any = new Error("You are already logged in on another device. Logout from there or confirm to proceed.");
            error.statusCode = 409; // Conflict
            throw error;
        }

        // 4. Invalidate old sessions if forced
        if (forceLogout) {
            await sessionService.invalidateAllSessions(user.id);
        }

        // 5. Generate Tokens
        const payload: { userId: string; email: string; role: string; plan_name?: string } = {
            userId: user.id,
            email: user.email,
            role: user.role.name,
        };

        if (user.role.name === UserRole.DOCTOR && user.doctor_profile?.plan?.plan_name) {
            payload.plan_name = user.doctor_profile.plan.plan_name;
        }

        const accessToken = tokenUtil.generateAccessToken(payload);
        const refreshToken = tokenUtil.generateRefreshToken(payload);

        // 6. Create Session
        await sessionService.createSession(user.id, refreshToken, deviceId, deviceName);

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role.name,
                first_name: user.first_name,
                last_name: user.last_name,
            },
            accessToken,
            refreshToken,
        };
    },
    forgotPassword: async (data: IForgotPasswordRequest) => {
        const { email } = data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return; // Silent return for security

        // Generate raw hex token (64 chars)
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashUtil.hashString(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.password_reset_token.create({
            data: {
                user_id: user.id,
                token_hash: tokenHash,
                expires_at: expiresAt,
            },
        });

        // 3. Send Reset Email
        await emailService.sendPasswordResetEmail(email, user.first_name, rawToken).catch(err => {
            console.error(`Failed to send reset email to ${email}:`, err);
        });

        // Simulated: Log token for development
        console.log(`[PASSWORD RESET for ${email}]: ${rawToken}`);
    },

    resetPassword: async (data: IResetPasswordRequest) => {
        const { token, password } = data;
        const tokenHash = hashUtil.hashString(token);

        const tokenRecord = await prisma.password_reset_token.findUnique({
            where: { token_hash: tokenHash },
            include: { user: true }
        });

        if (!tokenRecord || tokenRecord.is_used || tokenRecord.expires_at < new Date()) {
            const error: any = new Error("Invalid or expired reset token");
            error.statusCode = 400;
            throw error;
        }

        const password_hash = await bcrypt.hash(password, 10);

        await prisma.$transaction(async (tx) => {
            // Update password
            await tx.user.update({
                where: { id: tokenRecord.user_id },
                data: { password_hash },
            });

            // Mark token as used
            await tx.password_reset_token.update({
                where: { id: tokenRecord.id },
                data: { is_used: true },
            });

            // Revoke all existing sessions for security
            await tx.user_session.updateMany({
                where: { user_id: tokenRecord.user_id },
                data: { is_active: false },
            });
        });
    },

    validateSession: async (refreshToken: string) => {
        let decodedPayload;
        let isExpired = false;

        // Verify token expiry using jwt logic
        try {
            decodedPayload = tokenUtil.verifyRefreshToken(refreshToken);
        } catch (error: any) {
            if (error.name === "TokenExpiredError") {
                isExpired = true;
                // Decode without verification to get the payload (userId)
                decodedPayload = require('jsonwebtoken').decode(refreshToken);
                if (!decodedPayload) {
                    const err: any = new Error("Invalid refresh token format");
                    err.statusCode = 401;
                    throw err;
                }
            } else {
                const err: any = new Error("Invalid refresh token. Please Login");
                err.statusCode = 401;
                throw err;
            }
        }

        const userId = decodedPayload.userId;
        const hashOfProvidedToken = hashUtil.hashString(refreshToken);

        // Fetch session from DB using user_id, token hash, and is_active: true
        const session = await prisma.user_session.findFirst({
            where: {
                user_id: userId,
                refresh_token_hash: hashOfProvidedToken,
                is_active: true
            }
        });

        if (!session) {
            const error: any = new Error("You are logged in in other device");
            error.statusCode = 401;
            throw error;
        }

        if (isExpired) {
            // Set is_active to false in DB
            await prisma.user_session.update({
                where: { id: session.id },
                data: { is_active: false }
            });

            const err: any = new Error("Refresh token expired. Please Login");
            err.statusCode = 401;
            throw err;
        }

        return { message: "valid session" };
    },

    refreshToken: async (refreshToken: string) => {
        // 1. Validate session
        await authService.validateSession(refreshToken);

        // 2. Decode without any, it is strictly an ITokenPayload
        const decoded = tokenUtil.verifyRefreshToken(refreshToken);

        // 3. Create explicit payload based on requested types to strip potential `iat`/`exp` values from jwt.verify
        const payload: ITokenPayload = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        };

        if (decoded.plan_name !== undefined) {
            payload.plan_name = decoded.plan_name;
        }

        // 4. Generate the new token
        const accessToken = tokenUtil.generateAccessToken(payload);

        return { accessToken };
    },

    logout: async (userId: string, refreshToken: string) => {
        if (!userId || !refreshToken) {
            const error: any = new Error("Invalid request parameters for logout");
            error.statusCode = 400;
            throw error;
        }

        await sessionService.invalidateSession(userId, refreshToken);
    }
};
