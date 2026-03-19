import prisma from '../../prisma/prisma';
import bcrypt from 'bcrypt';
import { cloudinaryService } from '../../shared/services/cloudinary.service';
import { IUpdateDoctorProfileRequest, IUpdateDoctorProfileResponse } from './doctor.profile.types';
import { convertUtcToIstDate, convertISTToUTC, convertIstToUtc, calculateAge } from '../../shared/utils/timezone';
import { IGetDoctorAppointmentsQuery } from './doctor.validator';
import { appointment_status } from '../../shared/constants/appointment-status';
import { doctor_appointment_tabs } from '../../shared/constants/appointment-tabs';
import { doctor_plan } from '../../shared/constants/doctor-plan';
import { Prisma } from '@prisma/client';
 
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

        // 1.5. Validate Experience vs Age
        if (data.experience !== undefined && user.dob) {
            const age = calculateAge(user.dob);
            const maxExp = Math.max(0, age - 22);
            if (data.experience > maxExp) {
                const error: any = new Error(`Experience cannot exceed ${maxExp} years for your age`);
                error.statusCode = 400;
                throw error;
            }
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
 
    getAvailability: async (doctorId: string) => {
        const doctorExists = await prisma.doctor_profile.findUnique({
            where: { user_id: doctorId },
            include: { plan: true }
        });
 
        if (!doctorExists) {
            const error: any = new Error("Doctor not found");
            error.statusCode = 404;
            throw error;
        }
 
 
        // Calculate start of today in IST, then convert to UTC for DB query
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
 
        // IST Start of Day
        const istStartOfToday = new Date(Date.UTC(
            istNow.getUTCFullYear(),
            istNow.getUTCMonth(),
            istNow.getUTCDate(),
            0, 0, 0, 0
        ));
 
        // Convert back to UTC for Prisma
        const utcStartOfToday = new Date(istStartOfToday.getTime() - istOffset);
        const thirtyDaysFromNowUtc = new Date(utcStartOfToday.getTime() + 30 * 24 * 60 * 60 * 1000);
 
        const availabilityRecords = await prisma.availability.findMany({
            where: {
                doctor_id: doctorId,
                start_at: {
                    gte: utcStartOfToday,
                    lte: thirtyDaysFromNowUtc
                }
            },
            orderBy: {
                start_at: 'asc'
            }
        });
 
        const availabilities = availabilityRecords.map(record => {
            const istStartAt = convertUtcToIstDate(record.start_at)!;
            const istEndAt = convertUtcToIstDate(record.end_at)!;
            const dateStr = istStartAt.toISOString().split('T')[0];
 
            let breakDurationMs = 0;
            let istBreakStartAt = null;
            let istBreakEndAt = null;
 
            if (record.break_start && record.break_end) {
                breakDurationMs = record.break_end.getTime() - record.break_start.getTime();
                istBreakStartAt = convertUtcToIstDate(record.break_start);
                istBreakEndAt = convertUtcToIstDate(record.break_end);
            }
 
            return {
                date: dateStr,
                start_at: istStartAt,
                end_at: istEndAt,
                break_start: istBreakStartAt,
                break_end: istBreakEndAt,
                slot_duration: record.slot_duration,
                is_active: record.is_active,
                total_slots: record.queue_capacity
            };
        });
 
        return {
            doctor_id: doctorId,
            availabilities
        };
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
    },
 
    getAppointments: async (doctorId: string, query: IGetDoctorAppointmentsQuery) => {
        const {
            page = 1,
            limit = 4,
            tab,
            from,
            to,
            status,
            sort_by = 'nearest'
        } = query;
 
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 4;
        const skip = (pageNum - 1) * limitNum;
        const now = new Date();
 
        // 0. Just-in-time: Update past scheduled appointments to COMPLETED and pending to FAILED
        await prisma.$transaction([
            prisma.appointment.updateMany({
                where: {
                    doctor_id: doctorId,
                    status: appointment_status.SCHEDULED,
                    end_at: { lt: now }
                },
                data: {
                    status: appointment_status.COMPLETED
                }
            }),
            prisma.appointment.updateMany({
                where: {
                    doctor_id: doctorId,
                    status: appointment_status.PAYMENT_PENDING,
                    end_at: { lt: now }
                },
                data: {
                    status: appointment_status.PAYMENT_FAILED
                }
            })
        ]);
 
        // 1. Build where clause based on tab
        const where: Prisma.appointmentWhereInput = {
            doctor_id: doctorId
        };
 
        // Date range filtering (Applied to all tabs if provided)
        if (from || to) {
            where.start_at = {};
            if (from) where.start_at.gte = new Date(from);
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                where.start_at.lte = toDate;
            }
        }
 
        if (tab === doctor_appointment_tabs.ONGOING) {
            where.status = appointment_status.SCHEDULED;
            where.start_at = { lte: now, ...((where.start_at as any)?.gte ? { gte: (where.start_at as any).gte } : {}) };
            where.end_at = { gte: now };
        } else if (tab === doctor_appointment_tabs.SCHEDULED) {
            where.status = appointment_status.SCHEDULED;
            where.start_at = { gt: now, ...((where.start_at as any) || {}) };
        } else if (tab === doctor_appointment_tabs.HISTORY) {
            const historyStatuses = (status && status.length > 0
                ? status
                : [appointment_status.COMPLETED, appointment_status.PAYMENT_FAILED, appointment_status.REFUND_REQUESTED]) as any[];

            if (!from && !to) {
                const orConditions = [];
                if (historyStatuses.includes(appointment_status.COMPLETED)) {
                    orConditions.push({ status: appointment_status.COMPLETED, start_at: { lt: now } });
                }
                if (historyStatuses.includes(appointment_status.PAYMENT_FAILED)) {
                    orConditions.push({ status: appointment_status.PAYMENT_FAILED });
                }
                if (historyStatuses.includes(appointment_status.REFUND_REQUESTED)) {
                    orConditions.push({ status: appointment_status.REFUND_REQUESTED });
                }
                
                if (orConditions.length > 0) {
                    delete (where as any).status;
                    where.OR = orConditions;
                }
            } else {
                where.status = { in: historyStatuses as any };
            }
        }
 
        // 2. Sorting logic
        let orderBy: Prisma.appointmentOrderByWithRelationInput = { start_at: 'desc' };
        if (tab === 'scheduled' || tab === 'ongoing') {
            orderBy = { start_at: sort_by === 'nearest' ? 'asc' : 'desc' };
        } else {
            orderBy = { start_at: sort_by === 'nearest' ? 'desc' : 'asc' };
        }
 
        // 3. Execution
        const [totalAppointments, appointments] = await prisma.$transaction([
            prisma.appointment.count({ where }),
            prisma.appointment.findMany({
                where,
                skip,
                take: limitNum,
                orderBy,
                include: {
                    patient: {
                        include: {
                            user: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    profile_image: true,
                                    email: true,
                                    phone_number: true,
                                    dob: true
                                }
                            }
                        }
                    },
                    medical_reports: {
                        select: {
                            id: true,
                            report_url: true,
                            created_at: true
                        }
                    },
                    rating: {
                        select: {
                            id: true,
                            rating: true,
                            review: true
                        }
                    },
                    prescription: {
                        include: {
                            items: true
                        }
                    }
                }
            })
        ]);
 
        // 4. Formatting
        const formattedAppointments = appointments.map(app => {
            // Handle guest vs registered patient data
            const isGuest = !app.patient;
            
            // Calculate age only if patient profile exists
            let age = null;
            let dob = null;
            if (app.patient?.user.dob) {
                dob = new Date(app.patient.user.dob);
                const today = new Date();
                age = today.getFullYear() - dob.getFullYear();
                const m = today.getMonth() - dob.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                    age--;
                }
            }
 
            return {
                id: app.id,
                patient_id: app.patient_id,
                // Use guest fields if patient profile is missing
                patient_name: isGuest ? app.name : `${app.patient?.user.first_name} ${app.patient?.user.last_name}`,
                patient_avatar: isGuest ? null : app.patient?.user.profile_image,
                patient_email: isGuest ? app.email : app.patient?.user.email,
                patient_phone: isGuest ? app.phone : app.patient?.user.phone_number,
                patient_age: age,
                patient_dob: dob,
                start_time: convertUtcToIstDate(app.start_at),
                end_time: convertUtcToIstDate(app.end_at),
                status: app.status,
                description: app.description,
                medical_reports: app.medical_reports,
                queue_token: app.queue_token,
                // Full details for modal
                gender: app.gender,
                height: app.height,
                weight: app.weight,
                blood_group: app.blood_group,
                allergies: isGuest ? null : app.patient?.allergies,
                rating_details: app.rating,
                ai_generated_summary: app.ai_generated_summary,
                prescription: app.prescription
            };
        });
 
        const totalPages = Math.ceil(totalAppointments / limit);
 
        return {
            appointments: formattedAppointments,
            pagination: {
                total_items: totalAppointments,
                total_pages: totalPages,
                current_page: pageNum,
                limit
            }
        };
    },
 
    getAnalytics: async (doctorId: string, planName?: string, fromStr?: string, toStr?: string) => {
        // Total unique patients
        const uniquePatientsCount = await prisma.appointment.groupBy({
            by: ['patient_id'],
            where: { doctor_id: doctorId },
            _count: true
        }).then(res => res.length);
 
        // Total revenue from COMPLETED appointments
        const completedAppointments = await prisma.appointment.findMany({
            where: { doctor_id: doctorId, status: appointment_status.COMPLETED },
            include: { appointment_payment: true }
        });
        const totalRevenue = completedAppointments.reduce((sum, app) => sum + (app.appointment_payment?.amount || 0), 0);
 
        // Appointment status breakdown
        const statusBreakdown = await prisma.appointment.groupBy({
            by: ['status'],
            where: { doctor_id: doctorId },
            _count: {
                id: true
            }
        });
 
        const totalAppointments = await prisma.appointment.count({
            where: { doctor_id: doctorId }
        });
 
        const now = new Date();
        // Define IST Today boundaries in UTC
        const istTodayStart = convertISTToUTC('00:00', now);
        const istTodayEnd = convertISTToUTC('23:59:59', now);
        istTodayEnd.setMilliseconds(999);
 
        // Default range: Last 7 IST days
        let fromDate: Date;
        let toDate: Date;
 
        if (fromStr && toStr) {
            fromDate = convertIstToUtc(fromStr);
            // already at IST 00:00:00
            toDate = convertIstToUtc(toStr);
            // Move to end of day in IST (23:59:59.999)
            // convertIstToUtc for date-only gives IST 00:00 (which is 18:30 UTC previous day)
            // So we add 24 hours minus 1ms
            toDate.setTime(toDate.getTime() + (24 * 60 * 60 * 1000) - 1);
        } else {
            toDate = new Date(istTodayEnd);
            fromDate = new Date(istTodayStart);
            fromDate.setDate(fromDate.getDate() - 6);
        }
 
        // Calculate number of days in range
        const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
        const daysInRange = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 
        const recentAppointments = await prisma.appointment.findMany({
            where: {
                doctor_id: doctorId,
                start_at: {
                    gte: fromDate,
                    lte: toDate
                }
            },
            select: {
                start_at: true,
                status: true,
                appointment_payment: { select: { amount: true } }
            }
        });
 
        // Initialize daily stats within the range
        const dailyStats: Record<string, { appointments: number, revenue: number }> = {};
        for (let i = 0; i < daysInRange; i++) {
            const d = new Date(fromDate.getTime() + (i * 24 * 60 * 60 * 1000));
            const istD = convertUtcToIstDate(d);
            if (!istD) continue;
            const dateStr = istD.toISOString().split('T')[0];
            dailyStats[dateStr] = { appointments: 0, revenue: 0 };
        }
 
        recentAppointments.forEach(app => {
            const istDate = convertUtcToIstDate(app.start_at);
            if (!istDate) return;
            const dateStr = istDate.toISOString().split('T')[0];
            if (dailyStats[dateStr]) {
                dailyStats[dateStr].appointments += 1;
                if (app.status === appointment_status.COMPLETED) {
                    dailyStats[dateStr].revenue += (app.appointment_payment?.amount || 0);
                }
            }
        });
 
        const trend = Object.entries(dailyStats).map(([date, stats]) => ({
            date,
            ...stats
        }));
 
        let extra_metrics: any = {};
        if (planName === doctor_plan.PRO) {
            const upcomingBookings = await prisma.appointment.count({
                where: {
                    doctor_id: doctorId,
                    status: appointment_status.SCHEDULED,
                    start_at: { gt: now }
                }
            });
 
            // Calculate completion rate based on historical appointments (completed vs all non-scheduled/non-ongoing)
            const historicalCount = totalAppointments - upcomingBookings;
            const completedCount = statusBreakdown.find(s => s.status === appointment_status.COMPLETED)?._count.id || 0;
            const completionRate = historicalCount > 0 ? Math.round((completedCount / historicalCount) * 100) : 0;
 
            extra_metrics = {
                upcoming_bookings: upcomingBookings,
                completion_rate: completionRate
            };
        } else if (planName === doctor_plan.ELITE) {
            const todaysWalkins = await prisma.appointment.count({
                where: {
                    doctor_id: doctorId,
                    created_at: { gte: istTodayStart, lte: istTodayEnd }
                }
            });
 
            const currentWaitingList = await prisma.appointment.count({
                where: {
                    doctor_id: doctorId,
                    start_at: { gte: istTodayStart, lte: istTodayEnd },
                    status: appointment_status.SCHEDULED
                }
            });
 
            extra_metrics = {
                todays_walkins: todaysWalkins,
                current_waiting_list: currentWaitingList
            };
        }
 
        // --- ADVANCED ANALYTICS ---
 
        // 1. Average Rating
        const avgRatingAgg = await prisma.rating.aggregate({
            _avg: { rating: true },
            where: { doctor_id: doctorId }
        });
        const averageRating = avgRatingAgg._avg.rating ? Number(avgRatingAgg._avg.rating.toFixed(1)) : null;
 
        // 2. Repeat Patients
        const patientCounts = await prisma.appointment.groupBy({
            by: ['patient_id'],
            where: { doctor_id: doctorId },
            _count: { id: true }
        });
        const repeatPatients = patientCounts.filter(p => p._count.id > 1).length;
        const totalUniquePatients = patientCounts.length;
        const repeatPatientPercentage = totalUniquePatients > 0 
            ? Math.round((repeatPatients / totalUniquePatients) * 100) 
            : 0;
 
        // 3. Insight of the Day (Peak Hour & Busiest Day)
        let insightOfTheDay = "Welcome to your powerful analytics dashboard."; // default backup
        if (totalAppointments > 0) {
            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayCounts = Array(7).fill(0);
            const hourCounts = Array(24).fill(0);
 
            // Use recentAppointments (which is already filtered by the date range!) to find trends
            if (recentAppointments.length > 0) {
                 recentAppointments.forEach(app => {
                    const d = convertUtcToIstDate(app.start_at);
                    if(d) {
                        dayCounts[d.getDay()]++;
                        hourCounts[d.getHours()]++;
                    }
                });
 
                const busiestDayIndex = dayCounts.indexOf(Math.max(...dayCounts));
                const busiestHourIndex = hourCounts.indexOf(Math.max(...hourCounts));
                // Format hour cleanly (e.g. 14 -> 2 PM)
                const ampm = busiestHourIndex >= 12 ? 'PM' : 'AM';
                const formattedHour = busiestHourIndex % 12 === 0 ? 12 : busiestHourIndex % 12;
                const nextHour = (busiestHourIndex + 1) % 12 === 0 ? 12 : (busiestHourIndex + 1) % 12;
 
                insightOfTheDay = `Your busiest day is ${daysOfWeek[busiestDayIndex]}. Most patients visit between ${formattedHour}–${nextHour} ${ampm}.`;
            } else {
                 insightOfTheDay = "Analytics currently focusing on chosen date range. Not enough data today to form a peak insight.";
            }
        }
 
        // 4. Total Prescriptions Issued
        const totalPrescriptions = await prisma.prescription.count({
            where: {
                appointment: {
                    doctor_id: doctorId
                }
            }
        });
 
        // 5. Total Failed Payments
        const totalFailedPayments = statusBreakdown.find(s => s.status === appointment_status.PAYMENT_FAILED)?._count.id || 0;
 
        return {
            plan_type: planName || doctor_plan.PRO,
            total_patients: uniquePatientsCount,
            total_revenue: totalRevenue,
            total_appointments: totalAppointments,
            status_breakdown: statusBreakdown.map(s => ({ status: s.status, count: s._count.id })),
            trend,
            average_rating: averageRating,
            repeat_patient_percentage: repeatPatientPercentage,
            insight_of_the_day: insightOfTheDay,
            total_prescriptions: totalPrescriptions,
            total_failed_payments: totalFailedPayments,
            extra_metrics
        };
    }
};