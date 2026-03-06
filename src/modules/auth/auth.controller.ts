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
};
