import { Gender, IndianCity, Qualification, Specialty, doctor_plan } from "@prisma/client";
import { IApiResponse } from "@/types/global.types";

// patient signup request body
export interface IPatientSignupRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  password: string;
  gender: Gender;
  city: IndianCity;
  dob: string;
  verification_token: string;
}
export interface IAuthResponseData {
  user: {
    id: string;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface IPatientSignupResponse extends IApiResponse<IAuthResponseData> { }

// send verification otp request and response
export interface ISendVerificationOtpRequest {
  email: string;
}
interface IVerificationOtpData {
  token: string; // JWT containing hashed OTP — no DB storage needed
}
export interface ISendVerificationOtpResponse extends IApiResponse<IVerificationOtpData> { }

//verification otp request and response
export interface IVerifyOtpRequest {
  token: string;
  otp: string;
}
interface IVerificationTokenData {
  verification_token: string;
}
export interface IVerifyOtpResponse extends IApiResponse<IVerificationTokenData> { }

// login request and response
export interface ILoginRequest {
  email: string;
  password: string;
  forceLogout?: boolean; // For single device login policy
}
export interface ILoginResponse extends IApiResponse<IAuthResponseData> { }