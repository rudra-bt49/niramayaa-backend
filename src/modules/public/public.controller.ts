import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { publicService } from './public.service';

export const publicController = {
    getDoctorStatus: asyncHandler(async (req: Request, res: Response) => {
        const { doctorId } = req.params as { doctorId: string };
        try {
            const result = await publicService.getDoctorQueueStatus(doctorId);
            res.status(200).json(ApiResponse.success(result, 'Status fetched successfully'));
        } catch (error: any) {
            const status = error.status || 500;
            res.status(status).json(ApiResponse.error(error.message || 'Internal Server Error', status));
        }
    }),

    initiateGuestBooking: asyncHandler(async (req: Request, res: Response) => {
        const { doctorId } = req.params as { doctorId: string };
        try {
            const result = await publicService.createGuestCheckoutSession(doctorId, req.body);
            res.status(200).json(ApiResponse.success(result, 'Checkout session created'));
        } catch (error: any) {
            const status = error.status || 500;
            res.status(status).json(ApiResponse.error(error.message || 'Internal Server Error', status));
        }
    }),

    handleQStashWebhook: asyncHandler(async (req: Request, res: Response) => {
        const signature = req.headers['upstash-signature'] as string;
        try {
            const result = await publicService.processQStashWebhook(signature, req.body);
            res.status(200).send(result);
        } catch (error: any) {
            console.error('Finalize booking failed:', error);
            const status = error.status || 500;
            res.status(status).send(error.message || 'Internal Error');
        }
    })
};
