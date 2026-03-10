import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { patientSignupSchema, loginSchema, sendOtpSchema, verifyOtpSchema, doctorSignupSchema, forgotPasswordSchema, resetPasswordSchema, validateSessionSchema, refreshTokenSchema } from "./auth.validator";
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

router.post(
    API.AUTH.FORGOT_PASSWORD,
    validate(forgotPasswordSchema),
    authController.forgotPassword
);

router.post(
    API.AUTH.RESET_PASSWORD,
    validate(resetPasswordSchema),
    authController.resetPassword
);

router.post(
    API.AUTH.VALIDATE_SESSION,
    validate(validateSessionSchema),
    authController.validateSession
);

router.post(
    API.AUTH.REFRESH,
    validate(refreshTokenSchema),
    authController.refreshToken
);

export default router;
