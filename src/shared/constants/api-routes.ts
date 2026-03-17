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
        GET_APPOINTMENTS: '/patients/appointments',
        CHAT: '/patients/chat'
    },
    DOCTORS: "/doctors",
    DOCTOR_EXTRA: {
        GET_AVAILABILITY: '/availability',
        EDIT_AVAILABILITY: '/availability/edit',
        GET_APPOINTMENTS: '/appointments',
        GET_ANALYTICS: '/analytics',
    },
    PRESCRIPTION: {
        BASE: '/prescriptions',
        BY_APPOINTMENT: '/appointment/:appointmentId',
        // Doctor compatibility
        CREATE: '/appointments/:appointmentId/prescription',
        UPDATE: '/appointments/:appointmentId/prescription'
    },
    APPOINTMENT: {
        BASE: '/appointment',
        BOOK: '/book',
        GET_APPOINTMENT_STATUS: '/status/:sessionId',
        CANCEL_APPOINTMENT: '/cancel/:sessionId',
        EDIT_REPORTS: '/edit-reports',
    },
    QRCODE: {
        GET: '/qrcode',
        REGENERATE: '/qrcode/regenerate'
    },
    PAYMENT: {
        WEBHOOK: '/payments/webhook',
    },
    RATING: {
        BASE: '/ratings',
    },
};
