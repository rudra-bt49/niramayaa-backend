import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import paymentRoutes from "../modules/payment/payment.routes";

const router = Router();

router.use(authRoutes);
router.use(paymentRoutes);

export default router;
