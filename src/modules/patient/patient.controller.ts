import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { patientService } from './patient.service';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { IUpdatePatientProfileRequest } from './patient.profile.types';

export const patientController = {
    getProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const profile = await patientService.getProfile(userId);

        res.status(200).json(ApiResponse.success(profile, 'Profile fetched successfully'));
    }),

    updateProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const data = req.body as IUpdatePatientProfileRequest;
        const file = req.file;

        const updatedProfile = await patientService.updateProfile(userId, data, file);

        res.status(200).json(ApiResponse.success(updatedProfile, 'Profile updated successfully'));
    })
};
