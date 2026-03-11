export const API = {
    AUTH: {
        LOGIN: '/auth/login',
        REFRESH: '/auth/refresh',
        VALIDATE_SESSION: '/auth/validate',
        RESET_PASSWORD: '/auth/reset-password',
        FORGOT_PASSWORD: '/auth/forgot-password',
        SEND_OTP: '/send-verification-otp',
        VERIFY_OTP: '/verify-otp',
        PATIENT_SIGNUP: '/auth/patient-signup',
        DOCTOR_SIGNUP: '/auth/doctor-signup',
        VERIFY_DOCTOR_SESSION: '/auth/doctor-signup/verify-session',
        LOGOUT: '/auth/logout',
    },
    PROFILE: {
        UPDATE_PATIENT: "/patients/update-profile",
        UPDATE_DOCTOR: "/update-profile",
        GET_DOCTOR_PROFILE: "/profile",
        GET_PATIENT_PROFILE: "/patients/profile",
    },
    COMMON: {
        GET_DOCTORS: '/doctors/list',
    },
    PATIENTS: {
        GET_DOCTOR_AVAILABILITY: '/patients/availability/:doctorId',
    },
    DOCTORS: "/doctors",
    DOCTOR_EXTRA: {
        GET_AVAILABILITY: '/availability',
        EDIT_AVAILABILITY: '/availability/edit',
    },
    QRCODE: {
        GET: '/qrcode',
        REGENERATE: '/qrcode/regenerate'
    },
    PAYMENT: {
        WEBHOOK: '/payments/webhook',
    },
};
