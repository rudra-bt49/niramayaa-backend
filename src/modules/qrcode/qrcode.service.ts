import prisma from '../../prisma/prisma';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { cloudinaryService } from '../../shared/services/cloudinary.service';
import crypto from 'crypto';
import { IQRCodeResponse } from './qrcode.types';
import { doctor_plan } from '../../shared/constants/doctor-plan';

export const qrcodeService = {
    getQRCode: async (userId: string): Promise<IQRCodeResponse> => {
        // 1. Fetch doctor profile and verify ELITE plan
        const doctorProfile = await prisma.doctor_profile.findUnique({
            where: { user_id: userId },
            include: { plan: true }
        });

        if (!doctorProfile) {
            const error: any = new Error("Doctor profile not found");
            error.statusCode = 404;
            throw error;
        }

        if (!doctorProfile.plan || doctorProfile.plan.plan_name !== doctor_plan.ELITE) {
            const error: any = new Error("QR Code generation is only available for ELITE plan subscribers");
            error.statusCode = 403;
            throw error;
        }

        // 2. Return existing if present
        if (doctorProfile.qrcode_image_url && doctorProfile.qrcode_token) {
            const clientUrl = process.env.CLIENT_URL;
            return {
                qrcode_token: `${clientUrl}/appointments/book/${doctorProfile.qrcode_token}`,
                qrcode_image_url: doctorProfile.qrcode_image_url
            };
        }

        // 3. Otherwise generate a new one
        return await qrcodeService.generateAndSaveQRCode(userId);
    },

    regenerateQRCode: async (userId: string): Promise<IQRCodeResponse> => {
        const doctorProfile = await prisma.doctor_profile.findUnique({
            where: { user_id: userId },
            include: { plan: true }
        });

        if (!doctorProfile) {
            const error: any = new Error("Doctor profile not found");
            error.statusCode = 404;
            throw error;
        }

        if (!doctorProfile.plan || doctorProfile.plan.plan_name !== doctor_plan.ELITE) {
            const error: any = new Error("QR Code generation is only available for ELITE plan subscribers");
            error.statusCode = 403;
            throw error;
        }

        // Delete old QR code from Cloudinary if it exists
        if (doctorProfile.qrcode_public_id) {
            await cloudinaryService.deleteImage(doctorProfile.qrcode_public_id);
        }

        return await qrcodeService.generateAndSaveQRCode(userId);
    },

    // Helper function
    generateAndSaveQRCode: async (userId: string): Promise<IQRCodeResponse> => {
        // Encrypt hashed userId
        const iv = crypto.randomBytes(16);
        const secretKey = process.env.ACCESS_TOKEN_SECRET || 'fallback_secret_must_be_32_bytes_long_!!!'; // Should ideally be 32 bytes
        const key = crypto.createHash('sha256').update(String(secretKey)).digest('base64').substring(0, 32);
        
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
        let encrypted = cipher.update(userId, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Final token URL safe format: iv:encryptedData
        const newToken = `${iv.toString('hex')}:${encrypted}`;
        
        const clientUrl = process.env.CLIENT_URL;
        const fullBookingUrl = `${clientUrl}/appointments/book/${newToken}`;
        
        // Generate QR Code as a Buffer using the full frontend URL
        const qrBuffer = await QRCode.toBuffer(fullBookingUrl, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 500,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // Upload Buffer to Cloudinary
        const uploadResult = await cloudinaryService.uploadImageStream(qrBuffer, 'niramayaa/qrcodes/doctors');

        // Save to DB
        const updatedProfile = await prisma.doctor_profile.update({
            where: { user_id: userId },
            data: {
                qrcode_token: newToken,
                qrcode_image_url: uploadResult.secure_url,
                qrcode_public_id: uploadResult.public_id
            }
        });

        return {
            qrcode_token: `${clientUrl}/appointments/book/${updatedProfile.qrcode_token}`,
            qrcode_image_url: updatedProfile.qrcode_image_url as string
        };
    }
};
