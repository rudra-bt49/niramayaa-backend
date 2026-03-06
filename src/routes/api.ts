import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";

const router = Router();

// Mounting routes directly to allow module-specific paths (e.g. /auth/patient-signup)
// to be controlled entirely by the API constants.
router.use(authRoutes);

export default router;
