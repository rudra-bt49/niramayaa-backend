import { Response } from 'express';
import asyncHandler from 'express-async-handler';
import { prescriptionService } from './prescription.service';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { ICreatePrescriptionRequest, IUpdatePrescriptionRequest } from './prescription.validator';

export const prescriptionController = {
    /**
     * Create prescription handler
     */
    createPrescription: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const appointmentId = req.params.appointmentId as string;
        const data = req.body as ICreatePrescriptionRequest;

        const result = await prescriptionService.createPrescription(userId, appointmentId, data);

        res.status(201).json(ApiResponse.success(result, 'Prescription created successfully'));
    }),

    /**
     * Update prescription handler
     */
    updatePrescription: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const appointmentId = req.params.appointmentId as string;
        const data = req.body as IUpdatePrescriptionRequest;

        const result = await prescriptionService.updatePrescription(userId, appointmentId, data);

        res.status(200).json(ApiResponse.success(result, 'Prescription updated successfully'));
    }),

    /**
     * Get prescription handler
     */
    getPrescription: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const appointmentId = req.params.appointmentId as string;

        const result = await prescriptionService.getPrescription(userId, appointmentId);

        res.status(200).json(ApiResponse.success(result, 'Prescription fetched successfully'));
    })
};
