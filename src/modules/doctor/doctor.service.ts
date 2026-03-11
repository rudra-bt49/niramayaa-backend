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

        const safeUser = user as { password_hash?: string };
        safeUser.password_hash = undefined;
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

            const doctorUpdateData: Record<string, string | number | string[] | null> = {};
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
            const safeUpdated = updatedUser as { password_hash?: string };
            safeUpdated.password_hash = undefined;
        }

        return updatedUser;
    },

    createDefaultAvailability: async (doctorId: string) => {
        // Prevent duplicate availability creation
        const existing = await prisma.availability.findFirst({
            where: { doctor_id: doctorId }
        });
        if (existing) return;

        const availabilities = [];
        const slot_duration = 20;
        
        // Queue capacity: 9 AM to 1 PM (4 hrs, 12 slots) + 2 PM to 5 PM (3 hrs, 9 slots) = 21 slots.
        const queue_capacity = 21;

        const now = new Date();
        let daysAdded = 0;
        let dayOffset = 0;

        while (daysAdded < 30) {
            const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
            
            // Convert to IST (UTC + 5:30) to reliably check day of week
            const istTime = new Date(targetDate.getTime() + (5.5 * 60 * 60 * 1000));
            const dayOfWeek = istTime.getUTCDay(); // 0 is Sunday
            
            const year = istTime.getUTCFullYear();
            const month = istTime.getUTCMonth();
            const date = istTime.getUTCDate();

            // Helper to create UTC Date matching the expected IST hour and minute
            const createUtcFromIst = (hour: number, minute: number) => {
                const tempIst = new Date(Date.UTC(year, month, date, hour, minute, 0, 0));
                return new Date(tempIst.getTime() - (5.5 * 60 * 60 * 1000));
            };

            const start_at = createUtcFromIst(9, 0); // 9:00 AM IST -> 03:30 UTC
            const end_at = createUtcFromIst(17, 0); // 5:00 PM IST -> 11:30 UTC
            const break_start = createUtcFromIst(13, 0); // 1:00 PM IST -> 07:30 UTC
            const break_end = createUtcFromIst(14, 0); // 2:00 PM IST -> 08:30 UTC

            availabilities.push({
                doctor_id: doctorId,
                start_at,
                end_at,
                break_start,
                break_end,
                slot_duration,
                is_active: dayOfWeek !== 0, // False on Sundays
                queue_capacity
            });
            
            daysAdded++;
            dayOffset++;
        }

        if (availabilities.length > 0) {
            await prisma.availability.createMany({
                data: availabilities,
                skipDuplicates: true
            });
        }
    }
};
