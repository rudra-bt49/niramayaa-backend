import { Response, NextFunction } from 'express';
import { availabilityService } from './availability.service';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';

export class AvailabilityController {
    public editAvailability = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            // req.user is set by authMiddleware
            const doctorId = req.user?.userId;
            
            if (!doctorId) {
                return res.status(401).json(ApiResponse.error('Unauthorized: Doctor ID not found'));
            }

            const data = req.body;
            
            const results = await availabilityService.updateAvailability(doctorId, data);

            return res.status(200).json(
                ApiResponse.success(results, 'Availability updated successfully')
            );
        } catch (error) {
            next(error);
        }
    };
}

export const availabilityController = new AvailabilityController();
