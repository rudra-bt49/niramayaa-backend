import { IndianCity, Gender, BloodType, patient_profile } from '@prisma/client';
import { slot_status } from '../../shared/constants/slot-status';

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


export interface ISlot {
    start_time: Date | null;
    end_time: Date | null;
    status: slot_status;
}

export interface IDayAvailability {
    date: string;
    is_active: boolean;
    slots: ISlot[];
    start_time?: Date | null;
    end_time?: Date | null;
    break_start_time?: Date | null;
    break_end_time?: Date | null;
    slot_duration?: number;
}