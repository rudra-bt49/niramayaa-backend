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

// doctor signup request
export interface IDoctorSignupRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  password: string;
  gender: Gender;
  city: IndianCity;
  dob: string;
  qualifications: Qualification[];
  experience: number;
  specialties: Specialty[];
  consultation_fee: number;
  plan_name: doctor_plan["plan_name"];
  verification_token: string;
}

export interface IDoctorSignupResponse extends IApiResponse<{
  sessionId: string | null;
  sessionUrl: string | null;
}> { }

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

// Forgot/Reset Password
export interface IForgotPasswordRequest {
  email: string;
}

export interface IResetPasswordRequest {
  token: string;
  password: string;
}