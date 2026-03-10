import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { authService } from "./auth.service";
import { ApiResponse } from "../../shared/utils/ApiResponse";

export const authController = {
    signupPatient: asyncHandler(async (req: Request, res: Response) => {
        const result = await authService.patientSignup(req.body);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(201).json(
            ApiResponse.success(
                {
                    user: result.user,
                    accessToken: result.accessToken,
                },
                "Patient registered successfully",
                201
            )
        );
    }),

    sendOtp: asyncHandler(async (req: Request, res: Response) => {
        const result = await authService.sendVerificationOtp(req.body);
        res.status(200).json(
            ApiResponse.success(result, "OTP sent successfully", 200)
        );
    }),

    verifyOtp: asyncHandler(async (req: Request, res: Response) => {
        const result = await authService.verifyOtp(req.body);
        res.status(200).json(
            ApiResponse.success(result, "Email verified successfully", 200)
        );
    }),

    login: asyncHandler(async (req: Request, res: Response) => {
        const result = await authService.login(req.body);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(200).json(
            ApiResponse.success(
                {
                    user: result.user,
                    accessToken: result.accessToken,
                },
                "Login successful",
                200
            )
        );
    }),

    signupDoctor: asyncHandler(async (req: Request, res: Response) => {
        const result = await authService.doctorSignup(req.body);
        res.status(200).json(
            ApiResponse.success(result, "Doctor registration initiated. Please complete the payment.", 200)
        );
    }),

    verifyDoctorSession: asyncHandler(async (req: Request, res: Response) => {
        const { session_id } = req.body;
        if (!session_id) {
            res.status(400).json(ApiResponse.error("Session ID is required", 400));
            return;
        }

        const result = await authService.verifyDoctorPaymentSession(session_id);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(200).json(
            ApiResponse.success(
                {
                    user: result.user,
                    accessToken: result.accessToken,
                },
                "Doctor session verified and logged in successfully",
                200
            )
        );
    }),

    forgotPassword: asyncHandler(async (req: Request, res: Response) => {
        await authService.forgotPassword(req.body);
        res.status(200).json(
            ApiResponse.success(
                null,
                "If an account with that email exists, we have sent a reset link",
                200
            )
        );
    }),

    resetPassword: asyncHandler(async (req: Request, res: Response) => {
        await authService.resetPassword(req.body);
        res.status(200).json(
            ApiResponse.success(
                null,
                "Password reset successful. All active sessions have been logged out.",
                200
            )
        );
    }),

    validateSession: asyncHandler(async (req: Request, res: Response) => {
        const result = await authService.validateSession(req.body);
        res.status(200).json(
            ApiResponse.success(
                null,
                result.message,
                200
            )
        );
    }),

    refreshToken: asyncHandler(async (req: Request, res: Response) => {
        const result = await authService.refreshToken(req.body);
        res.status(200).json(
            ApiResponse.success(
                result,
                "Access token regenerated successfully",
                200
            )
        );
    }),
};
