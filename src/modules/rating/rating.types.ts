export interface CreateRatingRequest {
    appointment_id: string;
    rating: number;
    review?: string;
}

export interface RatingResponse {
    id: string;
    appointment_id: string;
    patient_id: string;
    doctor_id: string;
    rating: number;
    review: string | null;
    created_at: Date;
    updated_at: Date;
}
