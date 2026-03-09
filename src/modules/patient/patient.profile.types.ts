import { IndianCity, Gender, BloodType, patient_profile } from '@prisma/client';

export interface IUpdatePatientProfileRequest {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    city?: IndianCity;
    height?: number;
    weight?: number;
    blood_group?: BloodType;
    allergies?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    old_password?: string;
    new_password?: string;
    confirm_new_password?: string;
}

export interface IUpdatePatientProfileResponse {
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
    patient_profile: patient_profile | null;
}
