import { z } from 'zod';

export const createRatingSchema = z.object({
    body: z.object({
        appointment_id: z.string().uuid("Invalid appointment_id"),
        rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
        review: z.string().max(500, "Review must be at most 500 characters").optional(),
    }).strict()
});
