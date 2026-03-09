import { Router } from 'express';
import { patientController } from './patient.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/upload.middleware';
import { UserRole } from '../../shared/constants/roles';
import { validate } from '../../middlewares/validate.middleware';
import { updatePatientProfileSchema } from './patient.validator';
import { API } from '../../shared/constants/api-routes';

const router = Router();

router.get(
    API.PROFILE.GET_PATIENT_PROFILE,
    authMiddleware([UserRole.PATIENT]),
    patientController.getProfile
);

router.put(
    API.PROFILE.UPDATE_PATIENT,
    authMiddleware([UserRole.PATIENT]),
    upload.single('profile_image'),
    validate(updatePatientProfileSchema),
    patientController.updateProfile
);

export default router;
