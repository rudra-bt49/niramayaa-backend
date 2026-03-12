import { Gender, BloodType } from "@prisma/client";

export interface BookAppointmentReqBody {
    doctor_id: string;
    availability_id: string;
    start_at: string; // HH:MM
    end_at: string;   // HH:MM
    name: string;
    email: string;
    phone: string;
    height: number;
    weight: number;
    gender: Gender;
    blood_group: BloodType;
    description: string;
}

export interface BookAppointmentResponse {
    success: boolean;
    message: string;
    data: {
        checkoutUrl: string;
    };
}
