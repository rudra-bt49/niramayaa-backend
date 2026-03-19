import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { authService } from "./auth.service";
import { ApiResponse } from "../../shared/utils/ApiResponse";

import { hashUtil } from "../../shared/utils/hash.util";

import { AuthRequest } from "../../middlewares/auth.middleware";

const getDeviceInfo = (req: Request) => {
    const ua = (req as Request & { useragent?: { browser: string; version: string; os: string; platform: string } }).useragent;
    if (!ua) return { deviceId: "unknown", deviceName: "Unknown Device" };

    const deviceName = `${ua.browser} ${ua.version} on ${ua.os} (${ua.platform})`;
    // Create a stable device ID by hashing the user-agent string
    const deviceId = hashUtil.hashString(req.headers['user-agent'] || "unknown");

    return { deviceId, deviceName };
};

const getCookieOptions = (req: Request) => {
    const origin = req.headers.origin || req.headers.referer || '';
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isSecure = process.env.NODE_ENV === 'production' || process.env.SECURE_COOKIES === 'true' || !isLocalhost;
    return {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' as const : 'lax' as const,
        path: '/',
    };
};

export const authController = {
    signupPatient: asyncHandler(async (req: Request, res: Response) => {
        const { deviceId, deviceName } = getDeviceInfo(req);
        const result = await authService.patientSignup(req.body, deviceId, deviceName);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', result.refreshToken, {
            ...getCookieOptions(req),
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
        const { deviceId, deviceName } = getDeviceInfo(req);
        const result = await authService.login(req.body, deviceId, deviceName);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', result.refreshToken, {
            ...getCookieOptions(req),
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

        const { deviceId, deviceName } = getDeviceInfo(req);
        const result = await authService.verifyDoctorPaymentSession(session_id, deviceId, deviceName);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', result.refreshToken, {
            ...getCookieOptions(req),
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
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            res.status(401).json(ApiResponse.error("Session expired or missing. Please Login", 401));
            return;
        }
        await authService.validateSession(refreshToken);
        res.status(200).json(
            ApiResponse.success(
                null,
                "Session is valid",
                200
            )
        );
    }),

    validateSessionStream: asyncHandler(async (req: Request, res: Response) => {
        // Setup SSE Event Stream
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // Disable Nginx or reverse proxy buffering (if any)
        res.setHeader('X-Accel-Buffering', 'no');

        // Allow immediate responses
        res.flushHeaders?.();

        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            res.write(`data: ${JSON.stringify({ status: 401, message: "Session missing." })}\n\n`);
            res.end();
            return;
        }

        // Send an initial connected heartbeat
        res.write(`data: ${JSON.stringify({ status: 200, message: "Connected" })}\n\n`);
        (res as any).flush?.();

        // Check the database every 3 seconds for session validity
        const intervalId = setInterval(async () => {
            try {
                await authService.validateSession(refreshToken);
                // Send heartbeat to ensure stream stays alive
                res.write(`data: ${JSON.stringify({ status: 200, message: "Ping" })}\n\n`);
                (res as any).flush?.();
            } catch (error) {
                // If the session is invalid, notify the client and terminate connection
                res.write(`data: ${JSON.stringify({ status: 401, message: "Session expired or force-logged out." })}\n\n`);
                (res as any).flush?.();
                clearInterval(intervalId);
                res.end();
            }
        }, 3000);

        // Clean up when the client closes the connection
        req.on('close', () => {
            clearInterval(intervalId);
            res.end();
        });
    }),

    refreshToken: asyncHandler(async (req: Request, res: Response) => {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            res.status(401).json(ApiResponse.error("Session expired or missing. Please Login", 401));
            return;
        }
        const result = await authService.refreshToken(refreshToken);
        res.status(200).json(
            ApiResponse.success(
                result,
                "Access token regenerated successfully",
                200
            )
        );
    }),

    logout: asyncHandler(async (req: Request, res: Response) => {
        // req.user is populated by the authMiddleware guaranteeing the access_token is valid
        const userId = (req as AuthRequest).user?.userId;
        const refreshToken = req.cookies?.refreshToken;

        if (!userId || !refreshToken) {
            res.status(401).json(ApiResponse.error("Invalid session. Cannot process logout", 401));
            return;
        }

        await authService.logout(userId, refreshToken);

        // Clear the refresh token cookie on the client side
        res.clearCookie('refreshToken', getCookieOptions(req));

        res.status(200).json(
            ApiResponse.success(
                null,
                "Logout successful",
                200
            )
        );
    }),
};
