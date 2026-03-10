import { Router } from 'express';
import { qrcodeController } from './qrcode.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { UserRole } from '../../shared/constants/roles';
import { API } from '../../shared/constants/api-routes';

const router = Router();

router.get(
    API.QRCODE.GET,
    authMiddleware([UserRole.DOCTOR]),
    qrcodeController.getQRCode
);

router.post(
    API.QRCODE.REGENERATE,
    authMiddleware([UserRole.DOCTOR]),
    qrcodeController.regenerateQRCode
);

export default router;
