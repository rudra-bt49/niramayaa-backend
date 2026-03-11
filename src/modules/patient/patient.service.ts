import prisma from '../../prisma/prisma';
import bcrypt from 'bcrypt';
import { cloudinaryService } from '../../shared/services/cloudinary.service';
import { IUpdatePatientProfileRequest, IUpdatePatientProfileResponse } from './patient.profile.types';

import { IGetDoctorsQuery } from './patient.validator';
import { Prisma, Specialty, Qualification } from '@prisma/client';
import { convertUtcToIstDate, generateSlots } from '../../shared/utils/timezone';
import { doctor_plan } from '../../shared/constants/doctor-plan';
import { UserRole } from '../../shared/constants/roles';
import { appointment_status } from '../../shared/constants/appointment-status';
import { slot_status } from '../../shared/constants/slot-status';

interface HttpError extends Error {
    statusCode?: number;
}

interface ISlot {
    start_time: Date | null;
    end_time: Date | null;
    status: slot_status;
}

interface IDayAvailability {
    date: string;
    is_active: boolean;
    slots: ISlot[];
    start_time?: Date | null;
    end_time?: Date | null;
    break_start_time?: Date | null;
    break_end_time?: Date | null;
    slot_duration?: number;
}

export const patientService = {
    getProfile: async (userId: string): Promise<IUpdatePatientProfileResponse | null> => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { patient_profile: true }
        });

        if (!user) {
            const error: HttpError = new Error("User not found");
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
            const error: HttpError = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        // 2. Handle Password Change if requested
        let updatedPasswordHash = user.password_hash;
        if (data.old_password && data.new_password) {
            const isPasswordMatch = await bcrypt.compare(data.old_password, user.password_hash);
            if (!isPasswordMatch) {
                const error: HttpError = new Error("Invalid old password");
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
    },

    getDoctors: async (query: IGetDoctorsQuery) => {
        const {
            page = 1,
            limit = 4,
            search,
            locations,
            genders,
            specialties,
            min_experience,
            min_rating,
            min_fee,
            max_fee,
            sort_by
        } = query;

        const skip = (page - 1) * limit;

        // Base where clause for doctor_profile
        const where: Prisma.doctor_profileWhereInput = {};

        // 1. Search (multi-field search)
        if (search) {
            const searchUpper = search.toUpperCase();

            // Map the free-text search string to any matching enum values
            const matchedSpecialties = Object.values(Specialty).filter(s => s.replace(/_/g, ' ').includes(searchUpper) || s.includes(searchUpper));
            const matchedQualifications = Object.values(Qualification).filter(q => q.replace(/_/g, ' ').includes(searchUpper) || q.includes(searchUpper));

            const orConditions: Prisma.doctor_profileWhereInput[] = [
                { bio: { contains: search, mode: 'insensitive' } },
                {
                    user: {
                        OR: [
                            { first_name: { contains: search, mode: 'insensitive' } },
                            { last_name: { contains: search, mode: 'insensitive' } }
                        ]
                    }
                }
            ];

            if (matchedSpecialties.length > 0) {
                orConditions.push({ specialties: { hasSome: matchedSpecialties } });
            }

            if (matchedQualifications.length > 0) {
                orConditions.push({ qualifications: { hasSome: matchedQualifications } });
            }

            where.OR = orConditions;
        }

        // 2. Filters
        if (specialties && specialties.length > 0) {
            // Prisma Postgres hasSome for scalar lists
            where.specialties = { hasSome: specialties };
        }

        if (min_experience !== undefined) {
            where.experience = { gte: min_experience };
        }

        if (min_fee !== undefined || max_fee !== undefined) {
            where.consultation_fee = {};
            if (min_fee !== undefined) where.consultation_fee.gte = min_fee;
            if (max_fee !== undefined) where.consultation_fee.lte = max_fee;
        }

        const userWhere: Prisma.userWhereInput = {
            role: { name: UserRole.DOCTOR }
        };

        if (locations && locations.length > 0) {
            userWhere.city = { in: locations };
        }

        if (genders && genders.length > 0) {
            userWhere.gender = { in: genders };
        }

        // Apply user constraints to where
        where.user = userWhere;

        // Only PRO plan doctors should be visible to patients
        where.plan = {
            plan_name: doctor_plan.PRO
        };

        // 3. Min Rating
        if (min_rating !== undefined) {
            // Group ratings by doctor to find those with avg >= min_rating
            const ratingGroups = await prisma.rating.groupBy({
                by: ['doctor_id'],
                _avg: { rating: true },
                having: {
                    rating: { _avg: { gte: min_rating } }
                }
            });
            const validDoctorIds = ratingGroups.map(g => g.doctor_id);

            // Add these to our where clause
            where.user_id = { in: validDoctorIds };
        }

        // 4. Sorting
        let orderBy: Prisma.doctor_profileOrderByWithRelationInput = {};
        switch (sort_by) {
            case 'name_asc':
                orderBy = { user: { first_name: 'asc' } };
                break;
            case 'name_desc':
                orderBy = { user: { first_name: 'desc' } };
                break;
            case 'fee_asc':
                orderBy = { consultation_fee: 'asc' };
                break;
            case 'fee_desc':
                orderBy = { consultation_fee: 'desc' };
                break;
            default:
                // Default sorting (e.g. by newest)
                orderBy = { created_at: 'desc' };
        }

        // 5. Execute paginated queries
        const [totalDoctors, doctors] = await prisma.$transaction([
            prisma.doctor_profile.count({ where }),
            prisma.doctor_profile.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    user: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            gender: true,
                            city: true,
                            profile_image: true,
                        }
                    },
                    ratings_received: {
                        select: { rating: true }
                    }
                }
            })
        ]);

        // Process final response to calculate average ratings on the fly
        const formattedDoctors = doctors.map(doc => {
            const totalRatings = doc.ratings_received.length;
            const avgRating = totalRatings > 0
                ? doc.ratings_received.reduce((acc, curr) => acc + curr.rating, 0) / totalRatings
                : 0;

            const { ratings_received, ...restDoc } = doc;
            return {
                ...restDoc,
                average_rating: Number(avgRating.toFixed(1)),
                total_ratings: totalRatings
            };
        });

        const totalPages = Math.ceil(totalDoctors / limit);

        return {
            doctors: formattedDoctors,
            pagination: {
                total_items: totalDoctors,
                total_pages: totalPages,
                current_page: page,
                limit
            }
        };
    },

    getDoctorAvailability: async (doctorId: string, currentUser?: { userId: string, role: string }) => {
        const doctorExists = await prisma.doctor_profile.findUnique({
            where: { user_id: doctorId },
            include: { plan: true }
        });

        if (!doctorExists) {
            const error: HttpError = new Error("Doctor not found");
            error.statusCode = 404;
            throw error;
        }

        if (currentUser?.role === UserRole.DOCTOR) {
            if (currentUser.userId !== doctorId) {
                const error: HttpError = new Error("Doctors can only view their own availability");
                error.statusCode = 403;
                throw error;
            }
        } else {
            // PATIENT role checking
            if (doctorExists.plan?.plan_name !== doctor_plan.PRO) {
                const error: HttpError = new Error("Only PRO plan doctors have slot-based availability");
                error.statusCode = 403;
                throw error;
            }
        }

        // Find availability for the next 30 days
        const nowUtc = new Date();
        const thirtyDaysFromNowUtc = new Date(nowUtc.getTime() + 30 * 24 * 60 * 60 * 1000);

        const [availabilityRecords, appointments] = await prisma.$transaction([
            prisma.availability.findMany({
                where: {
                    doctor_id: doctorId,
                    start_at: {
                        gte: nowUtc,
                        lte: thirtyDaysFromNowUtc
                    }
                },
                orderBy: {
                    start_at: 'asc'
                }
            }),
            prisma.appointment.findMany({
                where: {
                    doctor_id: doctorId,
                    start_at: {
                        gte: nowUtc,
                        lte: thirtyDaysFromNowUtc
                    },
                    status: {
                        in: [appointment_status.SCHEDULED, appointment_status.COMPLETED]
                    }
                },
                select: {
                    start_at: true,
                    end_at: true,
                    status: true
                }
            })
        ]);

        // Process availability into mapped days
        const responseMap = new Map<string, IDayAvailability>();

        availabilityRecords.forEach(record => {
            // First generate the UTC slots excluding break time
            const slots = generateSlots(
                record.start_at,
                record.end_at,
                record.break_start,
                record.break_end,
                record.slot_duration
            );

            // Group the record by date (using IST)
            const istStartAt = convertUtcToIstDate(record.start_at)!;
            const dateStr = istStartAt.toISOString().split('T')[0];

            if (!responseMap.has(dateStr)) {
                const dayData: IDayAvailability = {
                    date: dateStr,
                    is_active: record.is_active,
                    slots: []
                };

                if (currentUser?.role === UserRole.DOCTOR && currentUser.userId === doctorId) {
                    dayData.start_time = convertUtcToIstDate(record.start_at);
                    dayData.end_time = convertUtcToIstDate(record.end_at);
                    dayData.break_start_time = record.break_start ? convertUtcToIstDate(record.break_start) : null;
                    dayData.break_end_time = record.break_end ? convertUtcToIstDate(record.break_end) : null;
                    dayData.slot_duration = record.slot_duration;
                }

                responseMap.set(dateStr, dayData);
            }

            const dayRecord = responseMap.get(dateStr)!;

            // Map each slot check against booked appointments and format returned times to IST
            slots.forEach(slot => {
                // Check if an appointment overlaps this slot in UTC
                const overlappingAppointment = appointments.find(app => {
                    const appStart = app.start_at.getTime();
                    const appEnd = app.end_at.getTime();
                    const slotStart = slot.start_time.getTime();
                    const slotEnd = slot.end_time.getTime();

                    // Standard overlap condition: StartA < EndB and EndA > StartB
                    return appStart < slotEnd && appEnd > slotStart;
                });

                let slotStatus = slot_status.AVAILABLE;
                if (overlappingAppointment && [appointment_status.SCHEDULED, appointment_status.COMPLETED].includes(overlappingAppointment.status as unknown as appointment_status)) {
                    slotStatus = slot_status.BOOKED;
                }


                dayRecord.slots.push({
                    start_time: convertUtcToIstDate(slot.start_time),
                    end_time: convertUtcToIstDate(slot.end_time),
                    status: slotStatus
                });
            });
        });

        // Convert Map to array and form the requested payload
        const availabilities = Array.from(responseMap.values());

        return {
            doctor_id: doctorId,
            availabilities
        };
    }
};
