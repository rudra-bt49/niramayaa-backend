const CLIENT_URL = process.env.CLIENT_URL;

export const StripeConfig = {
    SUCCESS_URL: `${CLIENT_URL}/auth/doctor-signup/success`,
    CANCEL_URL: `${CLIENT_URL}/auth/doctor-signup/payment-failed`,
};
