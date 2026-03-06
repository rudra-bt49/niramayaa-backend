import bcrypt from "bcrypt";
import prisma from "../../prisma/prisma";
import { IPatientSignupRequest, ILoginRequest, ISendVerificationOtpRequest, IVerifyOtpRequest } from "./auth.types";
import { UserRole } from "../../shared/constants/roles";
import { tokenUtil } from "../../shared/utils/token.util";
import { sessionService } from "./session.service";

export const authService = {
    sendVerificationOtp: async (data: ISendVerificationOtpRequest) => {
        const { email } = data;

        // 1. Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Generate short-lived token containing OTP and email
        const token = tokenUtil.generateOtpToken({ email, otp });

        // 3. Log OTP for development (in production, this would be emailed)
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

    patientSignup: async (data: IPatientSignupRequest) => {
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
        await sessionService.createSession(newUser.id, refreshToken);

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

    login: async (data: ILoginRequest) => {
        const { email, password, forceLogout } = data;

        // 1. Find User
        const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true },
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
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role.name,
        };

        const accessToken = tokenUtil.generateAccessToken(payload);
        const refreshToken = tokenUtil.generateRefreshToken(payload);

        // 6. Create Session
        await sessionService.createSession(user.id, refreshToken);

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
};
