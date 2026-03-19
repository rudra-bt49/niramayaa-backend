import prisma from "../../prisma/prisma";
import { doctor_plan } from "../../shared/constants/doctor-plan";
import { appointment_status } from "../../shared/constants/appointment-status";
import { stripeService } from "../../shared/services/stripe.service";
import { qstashService } from "../../shared/services/qstash.service";
import { qrcodeService } from "../qrcode/qrcode.service";
import { cloudinaryService } from "../../shared/services/cloudinary.service";
import { aiService } from "../AI/summary-generator/ai.service";
import Stripe from "stripe";

export const publicService = {
    getDoctorQueueStatus: async (doctorIdToken: string) => {
        const doctorId = qrcodeService.decryptToken(doctorIdToken);
        const doctor = await prisma.doctor_profile.findUnique({
            where: { user_id: doctorId },
            include: { 
                user: { 
                    select: { 
                        first_name: true, 
                        last_name: true,
                        email: true,
                        phone_number: true,
                        profile_image: true,
                        city: true,
                        gender: true
                    } 
                },
                plan: true 
            }
        });

        if (!doctor || doctor.plan?.plan_name !== doctor_plan.ELITE) {
            throw { status: 404, message: 'Doctor not found or not eligible for walk-ins' };
        }

        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        
        const startOfTodayIst = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 0, 0, 0, 0));
        const endOfTodayIst = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 23, 59, 59, 999));
        
        const startOfTodayUtc = new Date(startOfTodayIst.getTime() - istOffset);
        const endOfTodayUtc = new Date(endOfTodayIst.getTime() - istOffset);

        const availability = await prisma.availability.findFirst({
            where: {
                doctor_id: doctorId,
                start_at: { gte: startOfTodayUtc, lte: endOfTodayUtc },
                is_active: true
            }
        });

        if (!availability) {
            return { is_open: false };
        }

        const waitingCount = await prisma.appointment.count({
            where: {
                doctor_id: doctorId,
                status: appointment_status.SCHEDULED,
                start_at: { gte: startOfTodayUtc, lte: endOfTodayUtc }
            }
        });

        const lastAppt = await prisma.appointment.findFirst({
            where: {
                doctor_id: doctorId,
                start_at: { gte: startOfTodayUtc, lte: endOfTodayUtc },
                status: { in: [appointment_status.SCHEDULED, appointment_status.COMPLETED] as any }
            },
            orderBy: { end_at: 'desc' }
        });

        // Dynamic Capacity Check (Token count AND Time boundary)
        const nextStartTime = lastAppt ? new Date(Math.max(now.getTime(), lastAppt.end_at.getTime())) : new Date(Math.max(now.getTime(), availability.start_at.getTime()));
        const isTimeFull = new Date(nextStartTime.getTime() + availability.slot_duration * 60000) > availability.end_at;
        const isCapacityFull = availability.current_queue_token >= availability.queue_capacity;
        const isFull = isCapacityFull || isTimeFull;

        const estWaitTime = Math.max(0, Math.round((nextStartTime.getTime() - now.getTime()) / 60000));

        return {
            is_open: true,
            is_full: isFull,
            doctor_name: `Dr. ${doctor.user.first_name} ${doctor.user.last_name}`,
            doctor_image: doctor.user.profile_image,
            doctor_email: doctor.user.email,
            doctor_phone: doctor.user.phone_number,
            specialties: doctor.specialties,
            qualifications: doctor.qualifications,
            experience: doctor.experience,
            bio: doctor.bio,
            consultation_fee: doctor.consultation_fee,
            city: doctor.user.city,
            gender: doctor.user.gender,
            waiting_count: waitingCount,
            queue_capacity: availability.queue_capacity,
            est_wait_time_mins: estWaitTime,
            slot_duration: availability.slot_duration
        };
    },

    createGuestCheckoutSession: async (doctorIdToken: string, body: any, files?: Express.Multer.File[]) => {
        const doctorId = qrcodeService.decryptToken(doctorIdToken);
        const doctor = await prisma.doctor_profile.findUnique({
            where: { user_id: doctorId },
            include: { user: { select: { first_name: true, last_name: true } }, plan: true }
        });

        if (!doctor || doctor.plan?.plan_name !== doctor_plan.ELITE) {
            throw { status: 404, message: 'Doctor not found or not eligible for walk-ins' };
        }

        // 1. Process AI summary + Extract valid files
        const patientDescription = body.description || body['description '] || ''; // Support Postman trailing space
        console.log(`🔍 Guest Booking: Processing AI Summary for "${patientDescription}"`);
        
        const { ai_summary, validFiles } = await aiService.processDocuments(
            files || [],
            patientDescription
        );

        console.log(`✨ Guest Booking: AI Summary Generated: "${ai_summary}"`);

        // 2. Upload valid files to Cloudinary
        let reports = Array.isArray(body.reports) ? [...body.reports] : [];
        if (validFiles.length > 0) {
            console.log(`📤 Guest Booking: Uploading ${validFiles.length} valid reports...`);
            const uploadPromises = validFiles.map(file => 
                cloudinaryService.uploadImageStream(file.buffer, 'niramayaa/reports/guests')
            );
            const uploadedFiles = await Promise.all(uploadPromises);
            reports = [...reports, ...uploadedFiles.map(f => ({ url: f.secure_url, public_id: f.public_id }))];
        }

        // 3. Create Appointment in PAYMENT_PENDING status
        const pendingAppointment = await prisma.$transaction(async (tx) => {
            const appt = await tx.appointment.create({
                data: {
                    doctor_id: doctorId,
                    status: appointment_status.PAYMENT_PENDING as any,
                    name: `${(body.first_name || body['first_name '] || '').trim()} ${(body.last_name || body['last_name '] || '').trim()}`.trim(),
                    email: body.email || body['email '],
                    phone: `+91${(body.phone || body['phone '] || '').replace(/^\+91/, '')}`,
                    gender: (body.gender || body['gender '] || 'OTHER').toUpperCase(),
                    height: parseFloat(body.height || body['height '] || '0'),
                    weight: parseFloat(body.weight || body['weight '] || '0'),
                    blood_group: (body.blood_group || body['blood_group '] || 'O_POS').toUpperCase().replace(/\s+/g, '_'),
                    description: patientDescription,
                    ai_generated_summary: ai_summary && ai_summary.trim() !== "" ? ai_summary : "Medical summary being processed or unavailable.",
                    // Temporary start_at for pending state
                    start_at: new Date(),
                    end_at: new Date(Date.now() + 20 * 60000),
                } as any
            });

            if (reports.length > 0) {
                await tx.medical_report.createMany({
                    data: reports.map(r => ({
                        appointment_id: appt.id,
                        report_url: r.url,
                        report_public_id: r.public_id,
                    }))
                });
            }
            return appt;
        });
        
        console.log(`📝 Guest Booking: Created Pending Appointment: ${pendingAppointment.id}`);

        // 4. Create Stripe Session
        const session = await stripeService.createAppointmentCheckoutSession({
            patientEmail: body.email,
            doctorName: `Dr. ${doctor.user.first_name} ${doctor.user.last_name}`,
            amount: doctor.consultation_fee,
            successUrl: `${process.env.CLIENT_URL}/appointments/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${process.env.CLIENT_URL}/appointments/cancel?session_id={CHECKOUT_SESSION_ID}`,
            metadata: {
                registration_type: 'GUEST_WALKIN',
                appointment_id: pendingAppointment.id,
                doctor_id: doctorId,
                email: body.email,
            }
        });

        // 5. Create Pending Payment Record
        await prisma.appointment_payment.create({
            data: {
                appointment_id: pendingAppointment.id,
                amount: doctor.consultation_fee,
                currency: 'inr',
                payment_method: 'card',
                payment_status: 'pending',
                stripe_session_id: session.id,
            }
        });

        return { checkoutUrl: session.url };
    },

    processQStashWebhook: async (signature: string, payload: any) => {
        const rawBody = JSON.stringify(payload);

        const isValid = await qstashService.verifySignature(rawBody, signature);
        if (!isValid) {
            throw { status: 401, message: 'Invalid signature' };
        }

        const { metadata, status: paymentStatus, session_id } = payload;
        
        if (paymentStatus !== 'paid') {
            console.log(`ℹ️ Webhook: Ignoring non-paid session ${session_id}`);
            return 'Ignored';
        }

        const appointmentId = metadata.appointment_id;

        // Fetch receipt_url from Stripe
        let receipt_url: string | null = null;
        try {
            const expandedSession = await stripeService.getSessionDetails(session_id);
            const paymentIntent = expandedSession.payment_intent as Stripe.PaymentIntent;
            receipt_url = paymentIntent?.latest_charge 
                ? (paymentIntent.latest_charge as any).receipt_url 
                : null;
        } catch (err) {
            console.warn("⚠️ QStash Webhook: Could not fetch receipt_url", err);
        }

        const result = await prisma.$transaction(async (tx) => {
            const now = new Date();
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istNow = new Date(now.getTime() + istOffset);
            const startOfTodayUtc = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 0, 0, 0, 0) - istOffset);
            const endOfTodayUtc = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 23, 59, 59, 999) - istOffset);

            // 1. Fetch the Pending Appointment
            const appt = await tx.appointment.findUnique({
                where: { id: appointmentId }
            });

            if (!appt) {
                throw new Error(`Appointment ${appointmentId} not found`);
            }

            // 2. Check/Update Availability
            const availability = await tx.availability.findFirst({
                where: {
                    doctor_id: appt.doctor_id,
                    start_at: { gte: startOfTodayUtc, lte: endOfTodayUtc },
                    is_active: true
                }
            });

            // Calculate Dynamic Start Time first to check Time Boundary
            const lastAppt = await tx.appointment.findFirst({
                where: {
                    doctor_id: appt.doctor_id,
                    start_at: { gte: startOfTodayUtc, lte: endOfTodayUtc },
                    status: { in: [appointment_status.SCHEDULED, appointment_status.COMPLETED] as any }
                },
                orderBy: { end_at: 'desc' }
            });

            const baseStartTime = lastAppt ? lastAppt.end_at : availability?.start_at;
            const startAt = baseStartTime ? new Date(Math.max(now.getTime(), baseStartTime.getTime())) : now;

            const isTimeFull = availability ? new Date(startAt.getTime() + availability.slot_duration * 60000) > availability.end_at : true;
            const isCapacityFull = availability ? availability.current_queue_token >= availability.queue_capacity : true;

            const updateData: any = {
                appointment_payment: {
                    update: {
                        amount: (payload.amount || 0) / 100,
                        payment_status: 'paid',
                        receipt_url: receipt_url,
                        stripe_session_id: session_id
                    }
                }
            };

            if (!availability || isCapacityFull || isTimeFull) {
                // If full (Time or Token), record as REFUND_REQUESTED
                const updatedAppt = await tx.appointment.update({
                    where: { id: appointmentId },
                    data: {
                        ...updateData,
                        availability_id: availability?.id || null,
                        status: appointment_status.REFUND_REQUESTED as any,
                        start_at: new Date(),
                        end_at: new Date(Date.now() + 20 * 60000),
                    }
                });
                return { appt: updatedAppt, status: 'REFUND_REQUESTED' };
            }

            // 3. Increment Token
            const nextToken = availability.current_queue_token + 1;
            await tx.availability.update({
                where: { id: availability.id },
                data: { current_queue_token: nextToken }
            });

            // 4. Update Appointment to SCHEDULED
            const finalizedAppt = await tx.appointment.update({
                where: { id: appointmentId },
                data: {
                    ...updateData,
                    availability_id: availability.id,
                    start_at: startAt,
                    end_at: new Date(startAt.getTime() + availability.slot_duration * 60000),
                    status: appointment_status.SCHEDULED as any,
                    queue_token: nextToken
                }
            });

            return { appt: finalizedAppt, status: 'SCHEDULED', token: nextToken };
        });

        if (result.status === 'SCHEDULED') {
            console.log(`🎊 Success: Appointment finalized for guest ${result.appt.name}. Token: ${result.token}`);
        } else {
            console.log(`⚠️ Full: Queue full for guest ${result.appt.name}. Recorded as REFUND_REQUESTED.`);
        }

        return 'OK';
    }
};
