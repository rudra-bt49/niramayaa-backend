import prisma from "../../prisma/prisma";
import { CreateRatingRequest, RatingResponse } from "./rating.types";
import { AppointmentStatus } from "@prisma/client";

export class RatingService {
    async createRating(patientId: string, data: CreateRatingRequest): Promise<RatingResponse> {
        const { appointment_id, rating, review } = data;

        // 1. Verify appointment exists, belongs to the patient, and is completed
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointment_id },
            include: { rating: true }
        });

        if (!appointment) {
            throw new Error("Appointment not found");
        }

        if (appointment.patient_id !== patientId) {
            throw new Error("You are not authorized to rate this appointment");
        }

        if (appointment.status !== AppointmentStatus.COMPLETED) {
            throw new Error("You can only rate completed appointments");
        }

        // 2. Check if rating already exists
        if (appointment.rating) {
            throw new Error("You have already rated this appointment");
        }

        // 3. Create rating
        const newRating = await prisma.rating.create({
            data: {
                appointment_id,
                patient_id: patientId,
                doctor_id: appointment.doctor_id,
                rating,
                review: review ?? null,
            }
        });

        return newRating;
    }
}

export const ratingService = new RatingService();
