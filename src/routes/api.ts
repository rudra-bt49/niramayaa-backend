import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import paymentRoutes from "../modules/payment/payment.routes";
import patientRoutes from "../modules/patient/patient.routes";
import doctorRoutes from "../modules/doctor/doctor.routes";
import qrcodeRoutes from "../modules/qrcode/qrcode.routes";
import availabilityRoutes from "../modules/availability/availability.routes";
import appointmentRoutes from "../modules/appointment/appointment.routes";
import prescriptionRoutes from "../modules/prescription/prescription.routes";
import { API } from "../shared/constants/api-routes";

const router = Router();

router.use(authRoutes);
router.use(paymentRoutes);
router.use(patientRoutes);
router.use(API.DOCTORS, doctorRoutes);
router.use(API.DOCTORS, qrcodeRoutes);
router.use(API.DOCTORS, availabilityRoutes);
router.use(API.DOCTORS, prescriptionRoutes);
router.use(API.PRESCRIPTION.BASE, prescriptionRoutes);
router.use(API.APPOINTMENT.BASE, appointmentRoutes);

export default router;
