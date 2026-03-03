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
}
export interface IPatientSignupResponse extends IApiResponse<null> {}

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
}
export interface IDoctorSignupResponse extends IApiResponse<null> {}

// send verification otp request and response
export interface ISendVerificationOtpRequest {
    email: string;
}
interface IVerificationOtpData {
  token: string; // JWT containing hashed OTP — no DB storage needed
}
export interface ISendVerificationOtpResponse extends IApiResponse<IVerificationOtpData> {}

//verification otp request and response
export interface IVerifyOtpRequest {
  token: string;
  otp: string;
}
export interface IVerifyOtpResponse extends IApiResponse<null> {}

// login request and response
export interface ILoginRequest {
  email: string;
  password: string;
}
interface ILoginData {
  accessToken: string;
  refreshToken: string;
}
export interface ILoginResponse extends IApiResponse<ILoginData> {}