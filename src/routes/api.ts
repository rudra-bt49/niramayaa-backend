import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import paymentRoutes from "../modules/payment/payment.routes";
import patientRoutes from "../modules/patient/patient.routes";
import doctorRoutes from "../modules/doctor/doctor.routes";
import qrcodeRoutes from "../modules/qrcode/qrcode.routes";
import { API } from "../shared/constants/api-routes";

const router = Router();

router.use(authRoutes);
router.use(paymentRoutes);
router.use(patientRoutes);
router.use(API.DOCTORS, doctorRoutes);
router.use(API.DOCTORS, qrcodeRoutes);

export default router;
