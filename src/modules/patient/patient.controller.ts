import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { patientService } from './patient.service';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { IUpdatePatientProfileRequest } from './patient.types';
import { IGetDoctorsQuery, getDoctorsQuerySchema, getDoctorAvailabilitySchema, getAppointmentsQuerySchema } from './patient.validator';

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
    }),

    getDoctors: asyncHandler(async (req: Request, res: Response) => {
        // Parse the query again to get Zod transformed values (e.g., strings to arrays)
        const { query } = getDoctorsQuerySchema.parse({ query: req.query });

        const result = await patientService.getDoctors(query);

        res.status(200).json(ApiResponse.success(
            { doctors: result.doctors, pagination: result.pagination },
            'Doctors fetched successfully',
            200
        ));
    }),

    getDoctorAvailability: asyncHandler(async (req: AuthRequest, res: Response) => {
        const { params } = getDoctorAvailabilitySchema.parse({ params: req.params });

        const availability = await patientService.getDoctorAvailability(params.doctorId, req.user);

        res.status(200).json(ApiResponse.success(
            availability,
            'Doctor availability fetched successfully (IST timezone)',
            200
        ));
    }),

    getAppointments: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const { query } = getAppointmentsQuerySchema.parse({ query: req.query });

        const result = await patientService.getAppointments(userId, query);

        res.status(200).json(ApiResponse.success(
            result,
            'Appointments fetched successfully',
            200
        ));
    })
};
