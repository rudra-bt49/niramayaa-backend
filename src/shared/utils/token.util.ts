import jwt from "jsonwebtoken";
import { ITokenPayload, IVerificationOtpPayload, IEmailVerificationPayload } from "../../types/token.types";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET as string;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET as string;
const OTP_TOKEN_SECRET = process.env.OTP_TOKEN_SECRET as string;

const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY;
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY;
const OTP_TOKEN_EXPIRY = process.env.OTP_TOKEN_EXPIRY; // 5 minutes default for OTP

export const tokenUtil = {
    generateAccessToken: (payload: ITokenPayload) => {
        return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"] });
    },

    generateRefreshToken: (payload: ITokenPayload) => {
        return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"] });
    },

    verifyAccessToken: (token: string) => {
        return jwt.verify(token, ACCESS_TOKEN_SECRET) as ITokenPayload;
    },

    verifyRefreshToken: (token: string) => {
        return jwt.verify(token, REFRESH_TOKEN_SECRET) as ITokenPayload;
    },

    generateOtpToken: (payload: object) => {
        return jwt.sign(payload, OTP_TOKEN_SECRET, { expiresIn: OTP_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"] });
    },

    verifyOtpToken: (token: string) => {
        return jwt.verify(token, OTP_TOKEN_SECRET) as IVerificationOtpPayload;
    },

    generateVerificationToken: (payload: { email: string }) => {
        return jwt.sign({ ...payload, isVerified: true }, OTP_TOKEN_SECRET, { expiresIn: "20m" });
    },

    verifyVerificationToken: (token: string) => {
        return jwt.verify(token, OTP_TOKEN_SECRET) as IEmailVerificationPayload;
    },
};
