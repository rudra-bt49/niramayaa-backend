import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { appointmentService } from './appointment.service';
import { BookAppointmentReqBody } from './appointment.types';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const appointmentController = {
    bookAppointment: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const body = req.body as BookAppointmentReqBody;
        const files = req.files as Express.Multer.File[];

        const sessionUrl = await appointmentService.initiateBookingSession({
            userId,
            body,
            files: files || []
        });

        res.status(200).json({
            success: true,
            message: 'Checkout session created successfully',
            data: {
                checkoutUrl: sessionUrl
            }
        });
    }),
};
