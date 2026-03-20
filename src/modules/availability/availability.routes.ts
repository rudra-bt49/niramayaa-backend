import { Router } from 'express';
import { availabilityController } from './availability.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { UserRole } from '../../shared/constants/roles';
import { validate } from '../../middlewares/validate.middleware';
import { updateAvailabilitySchema } from './availability.validators';
import { API } from '../../shared/constants/api-routes';

const router = Router();

router.put(
    API.DOCTOR_EXTRA.EDIT_AVAILABILITY,
    authMiddleware([UserRole.DOCTOR]),
    validate(updateAvailabilitySchema),
    availabilityController.editAvailability
);

export default router;
