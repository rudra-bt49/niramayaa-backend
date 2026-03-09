import prisma from '../../prisma/prisma';
import bcrypt from 'bcrypt';
import { cloudinaryService } from '../../shared/services/cloudinary.service';
import { IUpdateDoctorProfileRequest, IUpdateDoctorProfileResponse } from './doctor.profile.types';

export const doctorService = {
    getProfile: async (userId: string): Promise<IUpdateDoctorProfileResponse | null> => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { doctor_profile: true }
        });

        if (!user) {
            const error: any = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        (user as any).password_hash = undefined;
        return user;
    },

    updateProfile: async (
        userId: string,
        data: IUpdateDoctorProfileRequest,
        file?: Express.Multer.File
    ): Promise<IUpdateDoctorProfileResponse | null> => {
        // 1. Fetch current user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { doctor_profile: true }
        });

        if (!user) {
            const error: any = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        // 2. Handle Password Change
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
            const uploadResult = await cloudinaryService.uploadImageStream(file.buffer, 'niramayaa/profiles/doctors');
            
            if (user.profile_image_public_id) {
                await cloudinaryService.deleteImage(user.profile_image_public_id);
            }

            profile_image = uploadResult.secure_url;
            profile_image_public_id = uploadResult.public_id;
        }

        // 4. Update Profile in Transaction
        const updatedUser = await prisma.$transaction(async (tx) => {
            const userUpdateData: any = {
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

            const doctorUpdateData: any = {};
            if (data.bio !== undefined) doctorUpdateData.bio = data.bio;
            if (data.experience !== undefined) doctorUpdateData.experience = data.experience;
            if (data.consultation_fee !== undefined) doctorUpdateData.consultation_fee = data.consultation_fee;
            
            // Handle arrays which might come as strings from FormData
            if (data.specialties) {
                doctorUpdateData.specialties = Array.isArray(data.specialties) ? data.specialties : JSON.parse(data.specialties);
            }
            if (data.qualifications) {
                doctorUpdateData.qualifications = Array.isArray(data.qualifications) ? data.qualifications : JSON.parse(data.qualifications);
            }

            const updatedDoctorProfile = await tx.doctor_profile.upsert({
                where: { user_id: userId },
                create: {
                    user_id: userId,
                    ...doctorUpdateData
                },
                update: doctorUpdateData
            });

            const fullUpdatedUser = await tx.user.findUnique({
                where: { id: userId },
                include: { doctor_profile: true }
            });

            return fullUpdatedUser;
        });

        if (updatedUser) {
            (updatedUser as any).password_hash = undefined;
        }

        return updatedUser;
    }
};
