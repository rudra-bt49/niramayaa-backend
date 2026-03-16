import prisma from '../../prisma/prisma';
import { BookAppointmentReqBody } from './appointment.types';
import { stripeService } from '../../shared/services/stripe.service';
import { cloudinaryService } from '../../shared/services/cloudinary.service';
import { AppointmentStatus } from '@prisma/client';
import { convertIstToUtc } from '../../shared/utils/timezone';
import { paymentService } from '../payment/payment.service';
import { aiService } from '../AI/summary-generator/ai.service';

export const appointmentService = {
    initiateBookingSession: async (params: {
        userId: string;
        body: BookAppointmentReqBody;
        files: Express.Multer.File[];
    }): Promise<{ checkoutUrl: string; warning?: string }> => {
        const { userId, body, files } = params;

        // 1. Validate the user/patient
        const patient = await prisma.user.findUnique({
            where: { id: userId },
            include: { patient_profile: true }
        });
        if (!patient || !patient.patient_profile) {
            throw new Error('Patient profile not found');
        }

        // 2. Validate the doctor
        const doctor = await prisma.user.findUnique({
            where: { id: body.doctor_id },
            include: { doctor_profile: true }
        });
        if (!doctor || !doctor.doctor_profile) {
            throw new Error('Doctor profile not found');
        }

        // 3. Find/Validate Availability
        const startAtUtc = convertIstToUtc(body.start_at);
        const endAtUtc = convertIstToUtc(body.end_at);

        const availability = await prisma.availability.findFirst({
            where: {
                doctor_id: body.doctor_id,
                is_active: true,
                start_at: { lte: startAtUtc },
                end_at: { gte: endAtUtc }
            }
        });

        if (!availability) {
            throw new Error('No valid active availability found for this slot');
        }

        // 4. Validation: start_at must be in the future
        const now = new Date();
        if (startAtUtc <= now) {
            throw new Error('Appointment must be booked for a future time');
        }

        // 5. Validation: Duration must match slot_duration
        const durationInMins = Math.round((endAtUtc.getTime() - startAtUtc.getTime()) / 60000);
        if (durationInMins !== availability.slot_duration) {
            throw new Error(`Slot duration (${durationInMins} mins) does not match doctor's expected slot duration of ${availability.slot_duration} mins`);
        }

        // 7. Ensure the slot is not already booked (Doctor check)
        const existingAppointment = await prisma.appointment.findFirst({
            where: {
                doctor_id: body.doctor_id,
                status: AppointmentStatus.SCHEDULED,
                start_at: startAtUtc,
            }
        });

        if (existingAppointment) {
            throw new Error('This slot is already booked');
        }

        // NEW: Check for patient overlap (Warning only)
        const patientOverlap = await prisma.appointment.findFirst({
            where: {
                patient_id: patient.id,
                status: AppointmentStatus.SCHEDULED,
                OR: [
                    {
                        start_at: { lt: endAtUtc },
                        end_at: { gt: startAtUtc }
                    }
                ]
            }
        });

        let warning: string | undefined;
        if (patientOverlap) {
            warning = "Warning: You already have an appointment booked for this time slot. You can still proceed with this booking if you wish.";
        }

        // 8. Process AI summary + upload valid medical reports to Cloudinary
        let ai_summary: string | null = null;
        const uploadedReports: { secure_url: string; public_id: string }[] = [];

        if (files && files.length > 0) {
            const { ai_summary: generatedSummary, validFiles } = await aiService.processDocuments(
                files,
                body.description ?? ''
            );
            ai_summary = generatedSummary;

            for (const file of validFiles) {
                try {
                    const result = await cloudinaryService.uploadImageStream(file.buffer, 'medical_reports');
                    uploadedReports.push(result);
                } catch (error) {
                    console.error('File upload failed', error);
                }
            }
        } else if (body.description?.trim()) {
            const { ai_summary: generatedSummary } = await aiService.processDocuments([], body.description);
            ai_summary = generatedSummary;
        }

        // 9. Create appointment record with PAYMENT_PENDING status upfront
        // This stores all patient data + AI summary + reports before Stripe session.
        // Webhook will update status to SCHEDULED or PAYMENT_FAILED.
        const startAtUtcDate = startAtUtc;
        const endAtUtcDate = endAtUtc;

        const pendingAppointment = await prisma.$transaction(async (tx) => {
            const appt = await tx.appointment.upsert({
                where: {
                    doctor_id_start_at: {
                        doctor_id: body.doctor_id,
                        start_at: startAtUtcDate,
                    }
                },
                create: {
                    patient_id: patient.id,
                    doctor_id: body.doctor_id,
                    availability_id: availability.id,
                    start_at: startAtUtcDate,
                    end_at: endAtUtcDate,
                    status: AppointmentStatus.PAYMENT_PENDING,
                    queue_token: null,
                    name: body.name,
                    email: body.email,
                    phone: body.phone,
                    height: body.height,
                    weight: body.weight,
                    gender: body.gender,
                    blood_group: body.blood_group,
                    description: body.description ?? '',
                    ai_generated_summary: ai_summary,
                },
                update: {
                    status: AppointmentStatus.PAYMENT_PENDING,
                    ai_generated_summary: ai_summary,
                },
            });

            if (uploadedReports.length > 0) {
                await tx.medical_report.deleteMany({ where: { appointment_id: appt.id } });
                await tx.medical_report.createMany({
                    data: uploadedReports.map(r => ({
                        appointment_id: appt.id,
                        report_url: r.secure_url,
                        report_public_id: r.public_id,
                    }))
                });
            }

            return appt;
        });

        // 10. Create Stripe Checkout Session with minimal metadata only
        const expiresAt = Math.floor(Date.now() / 1000) + (30 * 60);

        const session = await stripeService.createAppointmentCheckoutSession({
            patientEmail: patient.email,
            doctorName: `Dr. ${doctor.first_name} ${doctor.last_name}`,
            amount: doctor.doctor_profile.consultation_fee,
            successUrl: `${process.env.CLIENT_URL}/patient/appointment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${process.env.CLIENT_URL}/patient/appointment/cancel?session_id={CHECKOUT_SESSION_ID}`,
            expiresAt,
            metadata: {
                registration_type: 'APPOINTMENT_BOOKING',
                patient_id: patient.id,
                doctor_id: body.doctor_id,
                availability_id: availability.id,
                start_at: startAtUtcDate.toISOString(),
                end_at: endAtUtcDate.toISOString(),
                email: body.email,
            }
        });

        return { checkoutUrl: session.url as string, warning };
    },

    getAppointmentBySessionId: async (sessionId: string) => {
        // Fetch appointment inclusion payment and doctor details
        const payment = await prisma.appointment_payment.findFirst({
            where: { stripe_session_id: sessionId },
            include: {
                appointment: {
                    include: {
                        doctor: {
                            include: {
                                user: {
                                    select: {
                                        first_name: true,
                                        last_name: true,
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!payment) {
            throw new Error('Appointment not found for this session');
        }

        const doctor = payment.appointment.doctor.user;

        return {
            appointment: {
                ...payment.appointment,
                doctor_name: `Dr. ${doctor.first_name} ${doctor.last_name}`
            },
            payment: {
                amount: payment.amount,
                currency: payment.currency,
                payment_status: payment.payment_status,
                receipt_url: payment.receipt_url,
                payment_method: payment.payment_method
            }
        };
    },

    handleCancelledBooking: async (sessionId: string) => {
        const session = await stripeService.getSessionDetails(sessionId);
        if (!session) {
            throw new Error('Invalid Stripe session');
        }

        // Process as failure
        await paymentService.handleAppointmentSession(session as any, 'FAILURE');
        return { success: true };
    }
};