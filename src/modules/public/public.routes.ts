import { Router } from 'express';
import { publicController } from './public.controller';
import { validate } from '../../middlewares/validate.middleware';
import multer from 'multer';
import { guestBookingSchema, doctorStatusSchema } from './public.validator';
import { API } from '../../shared/constants/api-routes';

// Configure Multer for Guest Booking (Local Instance)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB limit per file
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and PDF are allowed.'));
        }
    },
});

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
    upload.array('reports', 5),
    validate(guestBookingSchema),
    publicController.initiateGuestBooking
);

export default router;
