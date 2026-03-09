import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { doctorService } from './doctor.service';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApiResponse } from '../../shared/utils/ApiResponse';

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

        const data = req.body;
        const file = req.file;

        const updatedProfile = await doctorService.updateProfile(userId, data, file);

        res.status(200).json(ApiResponse.success(updatedProfile, 'Profile updated successfully'));
    })
};
