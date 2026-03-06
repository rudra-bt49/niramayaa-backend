const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

export const StripeConfig = {
    SUCCESS_URL: `${CLIENT_URL}/doctor-signup/success`,
    CANCEL_URL: `${CLIENT_URL}/doctor-signup/payment-failed`,
};
