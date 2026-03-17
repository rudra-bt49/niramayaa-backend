import { Router } from 'express';
import multer from 'multer';
import { chatController } from './chatbot.controller';
import { API } from '../../../shared/constants/api-routes'; 
import { authMiddleware } from '../../../middlewares/auth.middleware'; 
import { UserRole } from '../../../shared/constants/roles';

const router = Router();

// Configure multer to hold files in memory before uploading to Cloudinary
const upload = multer({ 
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        // Explicitly allow only PDF and specific Image types
        const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 
    }
});
/**
 * POST /patients/chat
 * Make sure to include your authentication middleware so `req.user` is populated!
 */
router.post(
    API.PATIENTS.CHAT, 
    authMiddleware([UserRole.PATIENT]),
    upload.array('files'), 
    chatController
);

export default router;