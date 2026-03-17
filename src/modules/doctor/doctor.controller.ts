import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { doctorService } from './doctor.service';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { IUpdateDoctorProfileRequest } from './doctor.profile.types';

export const doctorController = {
    getProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const profile = await doctorService.getProfile(userId);

        res.status(200).json(ApiResponse.success(profile, 'Profile fetched successfully'));
    }),

    updateProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const data = req.body as IUpdateDoctorProfileRequest;
        const file = req.file;

        const updatedProfile = await doctorService.updateProfile(userId, data, file);

        res.status(200).json(ApiResponse.success(updatedProfile, 'Profile updated successfully'));
    }),

    getAvailability: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const availability = await doctorService.getAvailability(userId);
        res.status(200).json(ApiResponse.success(availability, 'Availability fetched successfully'));
    }),

    getAppointments: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const query = req.query as any;
        const result = await doctorService.getAppointments(userId, query);

        res.status(200).json(ApiResponse.success(result, 'Appointments fetched successfully'));
    }),

    getAnalytics: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        const planName = req.user?.plan_name;

        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const { from, to } = req.query as { from?: string, to?: string };
        const analytics = await doctorService.getAnalytics(userId, planName, from, to);
        res.status(200).json(ApiResponse.success(analytics, 'Analytics fetched successfully'));
    })
};
