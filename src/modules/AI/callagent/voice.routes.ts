import { Router } from "express";
import { voiceController } from "./voice.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { UserRole } from "../../../shared/constants/roles";
import { API } from "../../../shared/constants/api-routes";
import multer from "multer";
const router = Router();

const upload = multer({ 
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
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

// Endpoint for frontend to trigger the call
router.post(
    API.PATIENTS.VOICE_CALL,
    authMiddleware([UserRole.PATIENT]),
    upload.array('files'),
    voiceController.startCall
);

// Webhook endpoint for Vapi to send data to (MUST BE PUBLIC)
router.post(
    API.PATIENTS.VAPI_WEBHOOK, 
    voiceController.vapiWebhook
);

export default router;