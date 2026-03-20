import { Gender, BloodType } from "@prisma/client";

export interface BookAppointmentReqBody {
    doctor_id: string;
    start_at: string; // ISO String (e.g., 2026-03-12T10:30:00Z)
    end_at: string;   // ISO String (e.g., 2026-03-12T10:50:00Z)
    name: string;
    email: string;
    phone: string;
    height: number;
    weight: number;
    gender: Gender;
    blood_group: BloodType;
    description: string;

    call_id?: string;
    call_status?: string;
}

export interface BookAppointmentResponse {
    success: boolean;
    message: string;
    data: {
        checkoutUrl: string;
    };
}
