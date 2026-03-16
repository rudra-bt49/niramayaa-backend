import { Router } from "express";
import { ratingController } from "./rating.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { UserRole } from "../../shared/constants/roles";
import { validate } from "../../middlewares/validate.middleware";
import { createRatingSchema } from "./rating.validator";

const router = Router();

router.post(
    "/",
    authMiddleware([UserRole.PATIENT]),
    validate(createRatingSchema),
    ratingController.createRating
);

export default router;
