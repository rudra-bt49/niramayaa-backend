export interface ITokenPayload {
    userId: string;
    email: string;
    role: string;
}

export interface IVerificationOtpPayload {
    email: string;
    otp: string;
    iat: number;
    exp: number;
}
export interface IEmailVerificationPayload {
    email: string;
    isVerified: boolean;
    iat: number;
    exp: number;
}
