import prisma from '../../prisma/prisma';
import bcrypt from 'bcrypt';
import { cloudinaryService } from '../../shared/services/cloudinary.service';
import { IUpdatePatientProfileRequest, IUpdatePatientProfileResponse } from './patient.profile.types';

export const patientService = {
    getProfile: async (userId: string): Promise<IUpdatePatientProfileResponse | null> => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { patient_profile: true }
        });

        if (!user) {
            const error: any = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        const safeUser = user as { password_hash?: string };
        safeUser.password_hash = undefined;
        return user;
    },

    updateProfile: async (
        userId: string,
        data: IUpdatePatientProfileRequest,
        file?: Express.Multer.File
    ): Promise<IUpdatePatientProfileResponse | null> => {
        // 1. Fetch current user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { patient_profile: true }
        });

        if (!user) {
            const error: any = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        // 2. Handle Password Change if requested
        let updatedPasswordHash = user.password_hash;
        if (data.old_password && data.new_password) {
            const isPasswordMatch = await bcrypt.compare(data.old_password, user.password_hash);
            if (!isPasswordMatch) {
                const error: any = new Error("Invalid old password");
                error.statusCode = 400;
                throw error;
            }
            const salt = await bcrypt.genSalt(10);
            updatedPasswordHash = await bcrypt.hash(data.new_password, salt);
        }

        // 3. Handle Cloudinary Image Upload
        let profile_image = user.profile_image;
        let profile_image_public_id = user.profile_image_public_id;

        if (file) {
            // Upload to Cloudinary
            const uploadResult = await cloudinaryService.uploadImageStream(file.buffer, 'niramayaa/profiles/patients');
            
            // Delete old image if it exists
            if (user.profile_image_public_id) {
                await cloudinaryService.deleteImage(user.profile_image_public_id);
            }

            profile_image = uploadResult.secure_url;
            profile_image_public_id = uploadResult.public_id;
        }

        // 4. Update Profile in Transaction
        const updatedUser = await prisma.$transaction(async (tx) => {
            // Update User Base Table
            const userUpdateData: Record<string, string | null> = {
                password_hash: updatedPasswordHash,
                profile_image,
                profile_image_public_id
            };

            if (data.first_name) userUpdateData.first_name = data.first_name;
            if (data.last_name) userUpdateData.last_name = data.last_name;
            if (data.phone_number) userUpdateData.phone_number = `+91${data.phone_number.replace(/^\+91/, '')}`;
            if (data.city) userUpdateData.city = data.city;

            await tx.user.update({
                where: { id: userId },
                data: userUpdateData
            });

            // Update Patient Profile Table
            const patientUpdateData: Record<string, string | number | null> = {};
            if (data.height !== undefined) patientUpdateData.height = data.height;
            if (data.weight !== undefined) patientUpdateData.weight = data.weight;
            if (data.blood_group) patientUpdateData.blood_group = data.blood_group;
            if (data.allergies !== undefined) patientUpdateData.allergies = data.allergies;
            if (data.emergency_contact_name !== undefined) patientUpdateData.emergency_contact_name = data.emergency_contact_name;
            if (data.emergency_contact_phone !== undefined) {
                 patientUpdateData.emergency_contact_phone = `+91${data.emergency_contact_phone.replace(/^\+91/, '')}`;
            }

            const updatedPatientProfile = await tx.patient_profile.upsert({
                where: { user_id: userId },
                create: {
                    user_id: userId,
                    ...patientUpdateData
                },
                update: patientUpdateData
            });

            // Return joined data
            const fullUpdatedUser = await tx.user.findUnique({
                where: { id: userId },
                include: { patient_profile: true }
            });

            return fullUpdatedUser;
        });

        // Strip sensitive info before returning
        if (updatedUser) {
            const safeUpdated = updatedUser as { password_hash?: string };
            safeUpdated.password_hash = undefined;
        }

        return updatedUser;
    }
};
