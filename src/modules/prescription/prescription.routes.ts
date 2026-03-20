import { Router } from 'express';
import { prescriptionController } from './prescription.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { UserRole } from '../../shared/constants/roles';
import { validate } from '../../middlewares/validate.middleware';
import {
    createPrescriptionSchema,
    updatePrescriptionSchema,
    getPrescriptionParamsSchema
} from './prescription.validator';
import { API } from '../../shared/constants/api-routes';

const router = Router();

// Compatibility routes (doctors/appointments/:appointmentId/prescription)
router.post(
    API.PRESCRIPTION.CREATE,
    authMiddleware([UserRole.DOCTOR]),
    validate(createPrescriptionSchema),
    prescriptionController.createPrescription
);

router.put(
    API.PRESCRIPTION.UPDATE,
    authMiddleware([UserRole.DOCTOR]),
    validate(updatePrescriptionSchema),
    prescriptionController.updatePrescription
);

// Shared get route
router.get(
    API.PRESCRIPTION.BY_APPOINTMENT,
    authMiddleware([UserRole.PATIENT, UserRole.DOCTOR]),
    validate(getPrescriptionParamsSchema),
    prescriptionController.getPrescription
);

export default router;
