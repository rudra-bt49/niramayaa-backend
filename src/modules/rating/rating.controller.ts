import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { ratingService } from "./rating.service";
import { ApiResponse } from "../../shared/utils/ApiResponse";

export class RatingController {
    async createRating(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const patientId = req.user?.userId;
            if (!patientId) {
                res.status(401).json(ApiResponse.error("Unauthorized", 401));
                return;
            }

            const rating = await ratingService.createRating(patientId, req.body);
            
            res.status(201).json(ApiResponse.success(rating, "Rating submitted successfully", 201));
        } catch (error: any) {
            res.status(error.statusCode || 400).json(ApiResponse.error(error.message, error.statusCode || 400));
        }
    }
}

export const ratingController = new RatingController();
