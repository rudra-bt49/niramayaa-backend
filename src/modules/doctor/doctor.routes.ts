import { Router } from 'express';
import { doctorController } from './doctor.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/upload.middleware';
import { UserRole } from '../../shared/constants/roles';
import { validate } from '../../middlewares/validate.middleware';
import { updateDoctorProfileSchema } from './doctor.validator';
import { API } from '../../shared/constants/api-routes';

const router = Router();

router.get(
    API.PROFILE.GET_DOCTOR_PROFILE,
    authMiddleware([UserRole.DOCTOR]),
    doctorController.getProfile
);

router.put(
    API.PROFILE.UPDATE_DOCTOR,
    authMiddleware([UserRole.DOCTOR]),
    upload.single('profile_image'),
    validate(updateDoctorProfileSchema),
    doctorController.updateProfile
);

router.get(
    API.DOCTOR_EXTRA.GET_AVAILABILITY,
    authMiddleware([UserRole.DOCTOR]),
    doctorController.getAvailability
);

export default router;
