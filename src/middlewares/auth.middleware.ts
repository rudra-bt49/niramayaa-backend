import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../shared/constants/roles';

// Extend Express Request interface to hold the user payload
export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: UserRole;
    };
}

export const authMiddleware = (allowedRoles?: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
                return;
            }

            const token = authHeader.split(' ')[1];
            if (!process.env.ACCESS_TOKEN_SECRET) {
                console.error('ACCESS_TOKEN_SECRET is not defined');
                res.status(500).json({ success: false, message: 'Internal server error' });
                return;
            }

            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) as {
                userId: string;
                email: string;
                role: UserRole;
            };

            req.user = decoded;

            // Check role authorization if allowedRoles are specified
            if (allowedRoles && allowedRoles.length > 0) {
                if (!allowedRoles.includes(decoded.role)) {
                    res.status(403).json({ success: false, message: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}` });
                    return;
                }
            }

            next();
        } catch (error: any) {
            if (error.name === 'TokenExpiredError') {
                res.status(401).json({ success: false, message: 'Token has expired' });
                return;
            }
            res.status(401).json({ success: false, message: 'Invalid token' });
            return;
        }
    };
};
