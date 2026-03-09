import { IndianCity, Specialty, Qualification, Gender, doctor_profile } from '@prisma/client';

export interface IUpdateDoctorProfileRequest {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    city?: IndianCity;
    bio?: string;
    specialties?: Specialty[];
    experience?: number;
    qualifications?: Qualification[];
    consultation_fee?: number;
    old_password?: string;
    new_password?: string;
    confirm_new_password?: string;
}

export interface IUpdateDoctorProfileResponse {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    dob: Date;
    gender: Gender;
    city: IndianCity;
    phone_number: string | null;
    profile_image: string | null;
    profile_image_public_id: string | null;
    role_id: string;
    created_at: Date;
    updated_at: Date;
    doctor_profile: doctor_profile | null;
}
