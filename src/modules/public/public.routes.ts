import { Router } from 'express';
import { publicController } from './public.controller';
import { validate } from '../../middlewares/validate.middleware';
import { guestBookingSchema, doctorStatusSchema } from './public.validator';
import { API } from '../../shared/constants/api-routes';

const router = Router();

// Public doctor status for QR code scanners
router.get(
    API.PUBLIC.DOCTOR_STATUS,
    validate(doctorStatusSchema),
    publicController.getDoctorStatus
);

// Initiate a guest walk-in booking (Stripe)
router.post(
    API.PUBLIC.BOOK_GUEST,
    validate(guestBookingSchema),
    publicController.initiateGuestBooking
);

export default router;
