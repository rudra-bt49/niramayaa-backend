import prisma from "../../prisma/prisma";
import Stripe from 'stripe';
import { stripeService } from "../../shared/services/stripe.service";
import emailService from "../../shared/services/email.service";
import { UserRole } from "../../shared/constants/roles";
import { qstashService } from "../../shared/services/qstash.service";

export const paymentService = {
    handleWebhook: async (rawBody: string | Buffer, signature: string) => {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new Error("STRIPE_WEBHOOK_SECRET is missing");
        }

        let event;
        try {
            event = stripeService.verifyWebhook(rawBody, signature, webhookSecret);
        } catch (err: any) {
            console.error(`❌ Webhook signature verification failed: ${err.message}`);
            throw err;
        }

        // Handle the event
        console.log(`🔔 Webhook received event: ${event.type}`);
        
        switch (event.type) {
            case 'checkout.session.completed':
                console.log("Processing checkout.session.completed...");
                await paymentService.handleCompletedSubscription(event.data.object as Stripe.Checkout.Session);
                await paymentService.handleAppointmentSession(event.data.object as Stripe.Checkout.Session, 'SUCCESS');
                await paymentService.handleGuestWalkinSession(event.data.object as Stripe.Checkout.Session);
                break;
            case 'checkout.session.expired':
                console.log(`⚠️ Webhook: Session ${event.data.object.id} expired. Handling as failure if applicable.`);
                await paymentService.handleAppointmentSession(event.data.object as Stripe.Checkout.Session, 'FAILURE');
                break;
            case 'checkout.session.async_payment_failed':
                console.log(`❌ Webhook: Payment failed for session ${event.data.object.id}. Handling as failure.`);
                await paymentService.handleAppointmentSession(event.data.object as Stripe.Checkout.Session, 'FAILURE');
                break;
            default:
                console.log(`ℹ️ Webhook: Unhandled event type ${event.type}`);
        }

        return { received: true };
    },

    handleCompletedSubscription: async (session: Stripe.Checkout.Session) => {
        const { registration_type, email, first_name, last_name, phone_number, password_hash, gender, city, dob, qualifications, experience, specialties, consultation_fee, plan_name } = session.metadata || {};

        if (registration_type !== 'DOCTOR_SIGNUP') {
            console.log(`ℹ️ Webhook: Skipping non-signup session ${session.id}`);
            return;
        }

        try {
            let receipt_url: string | null = null;

            const result = await prisma.$transaction(async (tx) => {
                // 1. Check if user already exists (concurrency safety)
                let user = await tx.user.findUnique({ where: { email } });

                if (user) {
                    console.log(`ℹ️ Webhook: User ${email} already exists, skipping creation.`);
                    return null;
                }

                // 2. Get Doctor Role
                const doctorRole = await tx.role.findUnique({
                    where: { name: UserRole.DOCTOR },
                });

                if (!doctorRole) throw new Error("Doctor role not found");

                // 3. Find the plan
                const plan = await tx.doctor_plan.findUnique({
                    where: { plan_name: plan_name }
                });

                if (!plan) throw new Error(`Plan ${plan_name} not found`);

                // 4. Create User and Doctor Profile
                user = await tx.user.create({
                    data: {
                        email,
                        password_hash,
                        first_name,
                        last_name,
                        phone_number,
                        gender: gender as any,
                        city: city as any,
                        dob: new Date(dob),
                        role_id: doctorRole.id,
                        doctor_profile: {
                            create: {
                                qualifications: JSON.parse(qualifications),
                                experience: parseInt(experience),
                                specialties: JSON.parse(specialties),
                                consultation_fee: parseFloat(consultation_fee),
                                plan_id: plan.id,
                                plan_expires_at: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000)
                            },
                        },
                    },
                });

                // 5. Fetch expanded session to get receipt_url (optional but good)
                try {
                    const expandedSession = await stripeService.getSessionDetails(session.id);
                    const paymentIntent = expandedSession.payment_intent as Stripe.PaymentIntent;
                    receipt_url = paymentIntent?.latest_charge ? (paymentIntent.latest_charge as any).receipt_url : null;
                } catch (err) {
                    console.warn("⚠️ Webhook: Could not fetch receipt_url", err);
                }

                // 6. Record the payment
                await tx.subscription_payment.create({
                    data: {
                        doctor_id: user.id,
                        plan_id: plan.id,
                        amount: (session.amount_total || 0) / 100,
                        currency: session.currency || 'inr',
                        payment_method: session.payment_method_types?.[0] || 'card',
                        payment_status: session.payment_status,
                        stripe_session_id: session.id,
                        receipt_url: receipt_url,
                    }
                });

                console.log(`✅ Success: Created user and doctor profile for ${email} via Webhook.`);

                return { user, plan };
            });

            // 7. Send Invoice Email (Outside transaction for performance)
            if (result) {
                const { user, plan } = result;
                await emailService.sendSubscriptionInvoice(
                    user.email,
                    user.first_name,
                    plan.plan_name,
                    (session.amount_total || 0) / 100,
                    receipt_url
                ).catch(err => {
                    console.error("⚠️ Webhook: Failed to send invoice email", err);
                });
            }
        } catch (error) {
            console.error("❌ Webhook Error processing doctor creation:", error);
            throw error;
        }
    },

    handleAppointmentSession: async (session: Stripe.Checkout.Session, resultStatus: 'SUCCESS' | 'FAILURE') => {
        const {
            registration_type,
            patient_id,
            doctor_id,
            availability_id,
            start_at,
            end_at,
            email,
        } = session.metadata || {};

        if (registration_type !== 'APPOINTMENT_BOOKING') {
            return;
        }

        console.log(`🚀 Webhook: Processing appointment ${resultStatus} for ${email}...`);

        try {
            let receipt_url: string | null = null;
            if (resultStatus === 'SUCCESS') {
                try {
                    const expandedSession = await stripeService.getSessionDetails(session.id);
                    const paymentIntent = expandedSession.payment_intent as Stripe.PaymentIntent;
                    receipt_url = paymentIntent?.latest_charge ? (paymentIntent.latest_charge as any).receipt_url : null;
                } catch (err) {
                    console.warn("⚠️ Webhook: Could not fetch receipt_url for appointment", err);
                }
            }

            const startDateTime = new Date(start_at as string);
            const endDateTime = new Date(end_at as string);
            const newStatus = resultStatus === 'SUCCESS' ? 'SCHEDULED' : 'PAYMENT_FAILED';

            const appointment = await prisma.$transaction(async (tx) => {
                // 1. Find the existing PAYMENT_PENDING appointment created at booking time
                const existingAppointment = await tx.appointment.findUnique({
                    where: {
                        doctor_id_start_at: {
                            doctor_id: doctor_id as string,
                            start_at: startDateTime,
                        }
                    }
                });

                // Don't overwrite a SCHEDULED appointment with a failure
                if (existingAppointment?.status === 'SCHEDULED' && resultStatus === 'FAILURE') {
                    console.log(`ℹ️ Webhook: Appointment already SCHEDULED for ${email}, skipping failure recording.`);
                    return null;
                }

                // 2. Update appointment status — all data was stored at booking time (PAYMENT_PENDING)
                if (!existingAppointment) {
                    console.warn(`⚠️ Webhook: No pending appointment found for doctor ${doctor_id} at ${startDateTime}. Skipping.`);
                    return null;
                }

                const appt = await tx.appointment.update({
                    where: { id: existingAppointment.id },
                    data: { status: newStatus as any },
                });

                // 3. Create/Update Appointment Payment entry
                await tx.appointment_payment.upsert({
                    where: { appointment_id: appt.id },
                    create: {
                        appointment_id: appt.id,
                        amount: (session.amount_total || 0) / 100,
                        currency: session.currency || 'inr',
                        payment_method: session.payment_method_types?.[0] || 'card',
                        payment_status: resultStatus === 'SUCCESS' ? 'paid' : (session.payment_status || 'failed'),
                        receipt_url,
                        stripe_session_id: session.id
                    },
                    update: {
                        amount: (session.amount_total || 0) / 100,
                        currency: session.currency || 'inr',
                        payment_method: session.payment_method_types?.[0] || 'card',
                        payment_status: resultStatus === 'SUCCESS' ? 'paid' : (session.payment_status || 'failed'),
                        receipt_url,
                        stripe_session_id: session.id
                    }
                });

                console.log(`✅ Success: Recorded appointment ${resultStatus} for ${email} via Webhook.`);
                return appt;
            });

            // 4. Send confirmation emails after successful payment (outside transaction)
            if (resultStatus === 'SUCCESS' && appointment) {
                try {
                    // Fetch full appointment + patient + doctor details from DB for email
                    const fullAppointment = await prisma.appointment.findUnique({
                        where: { id: appointment.id },
                        include: {
                            patient: { include: { user: { select: { first_name: true, last_name: true, email: true } } } },
                            doctor: { include: { user: { select: { first_name: true, last_name: true, email: true } } } },
                        }
                    });

                    if (!fullAppointment) {
                        console.warn('⚠️ Webhook: Could not find appointment for email notification');
                    } else {
                        const formatDateTime = (date: Date) => ({
                            date: date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' }),
                            time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
                        });

                        const formatBloodGroup = (raw: string): string =>
                            raw.replace('_POS', ' +').replace('_NEG', ' -');

                        const startFmt = formatDateTime(fullAppointment.start_at);
                        const endFmt = formatDateTime(fullAppointment.end_at);
                        const amount = (session.amount_total || 0) / 100;
                        const doctorName = `${fullAppointment.doctor.user.first_name} ${fullAppointment.doctor.user.last_name}`;
                        const patientName = fullAppointment.name;

                        await Promise.allSettled([
                            emailService.sendAppointmentConfirmationToPatient(fullAppointment.email, {
                                patientName,
                                doctorName,
                                date: startFmt.date,
                                startTime: startFmt.time,
                                endTime: endFmt.time,
                                description: fullAppointment.description,
                                amount,
                                receiptUrl: receipt_url,
                            }),
                            emailService.sendAppointmentNotificationToDoctor(fullAppointment.doctor.user.email, {
                                doctorName,
                                patientName,
                                patientEmail: fullAppointment.email,
                                patientPhone: fullAppointment.phone,
                                patientGender: fullAppointment.gender as string,
                                patientBloodGroup: formatBloodGroup(fullAppointment.blood_group as string),
                                patientHeight: fullAppointment.height,
                                patientWeight: fullAppointment.weight,
                                date: startFmt.date,
                                startTime: startFmt.time,
                                endTime: endFmt.time,
                                description: fullAppointment.description,
                            }),
                        ]).then(results => {
                            results.forEach((r, i) => {
                                if (r.status === 'rejected') {
                                    console.error(`⚠️ Webhook: Appointment email ${i === 0 ? '(patient)' : '(doctor)'} failed:`, r.reason);
                                } else {
                                    console.log(`✅ Webhook: Appointment email ${i === 0 ? '(patient)' : '(doctor)'} sent successfully`);
                                }
                            });
                        });
                    }
                } catch (emailErr) {
                    console.error('⚠️ Webhook: Failed to send appointment emails:', emailErr);
                }
            }

        } catch (error) {
            console.error(`❌ Webhook Error processing appointment ${resultStatus} creation:`, error);
            throw error;
        }
    },

    handleGuestWalkinSession: async (session: Stripe.Checkout.Session) => {
        const { registration_type } = session.metadata || {};

        if (registration_type !== 'GUEST_WALKIN') {
            return;
        }

        console.log(`🚀 Webhook: Forwarding GUEST_WALKIN session ${session.id} to QStash...`);

        try {
            await qstashService.publishToQueue({
                session_id: session.id,
                metadata: session.metadata,
                status: session.payment_status,
                amount: session.amount_total
            });
            console.log(`✅ Success: Forwarded session ${session.id} to QStash.`);
        } catch (error) {
            console.error(`❌ Webhook Error forwarding to QStash:`, error);
        }
    },

    getPaymentUrl: async (appointmentId: string) => {
        const payment = await prisma.appointment_payment.findUnique({
            where: { appointment_id: appointmentId },
        });

        if (!payment || !payment.stripe_session_id) {
            throw new Error("Payment record not found for this appointment.");
        }

        const session = await stripeService.getSessionDetails(payment.stripe_session_id);

        if (session.payment_status === 'paid') {
            throw new Error("Payment has already been completed for this appointment.");
        }

        if (session.status === 'expired') {
            await prisma.appointment.update({
                where: { id: appointmentId },
                data: { status: 'PAYMENT_FAILED' },
            });
            throw new Error("Payment session has expired. Please try booking again.");
        }

        if (session.status === 'open') {
            return session.url;
        }

        throw new Error(`Payment session is in state: ${session.status}`);
    }
};