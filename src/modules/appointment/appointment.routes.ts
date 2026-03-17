import { Router } from 'express';
import { appointmentController } from './appointment.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { UserRole } from '../../shared/constants/roles';
import { validate } from '../../middlewares/validate.middleware';
import { bookAppointmentSchema } from './appointment.validator';
import multer from 'multer';
import { API } from '../../shared/constants/api-routes';

const router = Router();

// Configure Multer for file uploads (Memory Storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit per file
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

router.post(
    API.APPOINTMENT.BOOK,
    authMiddleware([UserRole.PATIENT]),
    upload.array('reports', 5), // 'reports' field, max 5 files
    validate(bookAppointmentSchema),
    appointmentController.bookAppointment
);

router.get(
    API.APPOINTMENT.GET_APPOINTMENT_STATUS,
    authMiddleware([UserRole.PATIENT]),
    appointmentController.getAppointmentStatus
);

router.post(API.APPOINTMENT.CANCEL_APPOINTMENT, authMiddleware([UserRole.PATIENT]), appointmentController.handleCancel);

router.patch(
    API.APPOINTMENT.EDIT_REPORTS,
    authMiddleware([UserRole.PATIENT]),
    upload.array('reports', 5),
    appointmentController.updateMedicalReports
);

export default router;
