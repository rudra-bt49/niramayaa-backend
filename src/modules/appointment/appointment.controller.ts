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

        const { checkoutUrl, warning } = await appointmentService.initiateBookingSession({
            userId,
            body,
            files: files || []
        });

        res.status(200).json({
            success: true,
            message: warning || 'Checkout session created successfully',
            data: {
                checkoutUrl
            }
        });
    }),

    getAppointmentStatus: asyncHandler(async (req: Request, res: Response) => {
        const { sessionId } = req.params;

        if (!sessionId) {
            res.status(400).json({ success: false, message: 'Session ID is required' });
            return;
        }

        const data = await appointmentService.getAppointmentBySessionId(sessionId as string);

        res.status(200).json({
            success: true,
            data
        });
    }),

    handleCancel: asyncHandler(async (req: Request, res: Response) => {
        const { sessionId } = req.params;

        if (!sessionId) {
            res.status(400).json({ success: false, message: 'Session ID is required' });
            return;
        }

        await appointmentService.handleCancelledBooking(sessionId as string);

        res.status(200).json({
            success: true,
            message: 'Appointment cancellation recorded successfully'
        });
    }),

    updateMedicalReports: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { appointmentId, existing_reports } = req.body;
        const files = req.files as Express.Multer.File[];

        // existing_reports comes as a JSON string from form-data
        let existingReportIds: string[] = [];
        if (existing_reports) {
            try {
                const parsed = JSON.parse(existing_reports);
                existingReportIds = Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                res.status(400).json({ success: false, message: 'Invalid existing_reports format' });
                return;
            }
        }

        const result = await appointmentService.updateMedicalReports({
            userId,
            appointmentId,
            existingReportIds,
            newFiles: files || []
        });

        res.status(200).json(result);
    }),
};
