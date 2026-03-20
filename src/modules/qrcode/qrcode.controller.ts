import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { qrcodeService } from './qrcode.service';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApiResponse } from '../../shared/utils/ApiResponse';

export const qrcodeController = {
    getQRCode: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const qrcodeData = await qrcodeService.getQRCode(userId);

        res.status(200).json(ApiResponse.success(qrcodeData, 'QR Code retrieved successfully'));
    }),

    regenerateQRCode: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(ApiResponse.error('Unauthorized', 401));
            return;
        }

        const qrcodeData = await qrcodeService.regenerateQRCode(userId);

        res.status(200).json(ApiResponse.success(qrcodeData, 'QR Code regenerated successfully'));
    })
};
