import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { patientSignupSchema, loginSchema, sendOtpSchema, verifyOtpSchema, doctorSignupSchema } from "./auth.validator";
import { API } from "../../shared/constants/api-routes";

const router = Router();

router.post(
    API.AUTH.SEND_OTP,
    validate(sendOtpSchema),
    authController.sendOtp
);

router.post(
    API.AUTH.VERIFY_OTP,
    validate(verifyOtpSchema),
    authController.verifyOtp
);

router.post(
    API.AUTH.PATIENT_SIGNUP,
    validate(patientSignupSchema),
    authController.signupPatient
);

router.post(
    API.AUTH.DOCTOR_SIGNUP,
    validate(doctorSignupSchema),
    authController.signupDoctor
);

router.post(
    API.AUTH.VERIFY_DOCTOR_SESSION,
    authController.verifyDoctorSession
);

router.post(
    API.AUTH.LOGIN,
    validate(loginSchema),
    authController.login
);

export default router;
