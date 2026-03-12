import prisma from "../../prisma/prisma";
import Stripe from 'stripe';
import { stripeService } from "../../shared/services/stripe.service";
import emailService from "../../shared/services/email.service";
import { UserRole } from "../../shared/constants/roles";

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
                await handleCompletedSubscription(event.data.object as Stripe.Checkout.Session);
                await handleAppointmentSession(event.data.object as Stripe.Checkout.Session, 'SUCCESS');
                break;
            case 'checkout.session.expired':
                console.log(`⚠️ Webhook: Session ${event.data.object.id} expired. Handling as failure if applicable.`);
                await handleAppointmentSession(event.data.object as Stripe.Checkout.Session, 'FAILURE');
                break;
            case 'checkout.session.async_payment_failed':
                console.log(`❌ Webhook: Payment failed for session ${event.data.object.id}. Handling as failure.`);
                await handleAppointmentSession(event.data.object as Stripe.Checkout.Session, 'FAILURE');
                break;
            default:
                console.log(`ℹ️ Webhook: Unhandled event type ${event.type}`);
        }

        return { received: true };
    }
};

async function handleCompletedSubscription(session: Stripe.Checkout.Session) {
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
}

async function handleAppointmentSession(session: Stripe.Checkout.Session, resultStatus: 'SUCCESS' | 'FAILURE') {
    const {
        registration_type,
        patient_id,
        doctor_id,
        availability_id,
        start_at,
        end_at,
        name,
        email,
        phone,
        height,
        weight,
        gender,
        blood_group,
        description,
        medical_reports
    } = session.metadata || {};

    if (registration_type !== 'APPOINTMENT_BOOKING') {
        console.log(`ℹ️ Webhook: Skipping session ${session.id} - registration_type is ${registration_type}`);
        return; // Ignore other types like DOCTOR_SIGNUP
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

        const reports: { secure_url: string; public_id: string }[] = JSON.parse(medical_reports || '[]');

        const startDateTime = new Date(start_at as string);
        const endDateTime = new Date(end_at as string);

        await prisma.$transaction(async (tx) => {
            // 1. Check if an appointment already exists for this doctor and time
            // This prevents unique constraint violations if multiple sessions were initiated for the same slot
            const existingAppointment = await tx.appointment.findUnique({
                where: {
                    doctor_id_start_at: {
                        doctor_id: doctor_id as string,
                        start_at: startDateTime,
                    }
                }
            });

            // If we already have a SCHEDULED appointment, we don't want to overwrite it with a FAILURE/EXPIRED status
            if (existingAppointment?.status === 'SCHEDULED' && resultStatus === 'FAILURE') {
                console.log(`ℹ️ Webhook: Appointment already SCHEDULED for ${email}, skipping failure recording.`);
                return;
            }

            // 2. Create or Update Appointment
            const appointmentData = {
                patient_id: patient_id as string,
                doctor_id: doctor_id as string,
                availability_id: availability_id as string,
                start_at: startDateTime,
                end_at: endDateTime,
                status: resultStatus === 'SUCCESS' ? 'SCHEDULED' : 'PAYMENT_FAILED' as any,
                queue_token: null,
                name: name as string,
                email: email as string,
                phone: phone as string,
                height: parseFloat(height || '0'),
                weight: parseFloat(weight || '0'),
                gender: gender as any,
                blood_group: blood_group as any,
                description: description as string,
            };

            const appointment = await tx.appointment.upsert({
                where: {
                    doctor_id_start_at: {
                        doctor_id: doctor_id as string,
                        start_at: startDateTime,
                    }
                },
                create: appointmentData,
                update: appointmentData,
            });

            // 3. Create Medical Reports (only if it's a new appointment or we want to overwrite)
            // For simplicity, we only create if it's a new appointment or reports aren't there
            if (reports.length > 0) {
                // Delete existing reports if it's an update (to avoid duplicates)
                await tx.medical_report.deleteMany({ where: { appointment_id: appointment.id } });
                
                await tx.medical_report.createMany({
                    data: reports.map(report => ({
                        appointment_id: appointment.id,
                        report_url: report.secure_url,
                        report_public_id: report.public_id
                    }))
                });
            }

            // 4. Create/Update Appointment Payment entry
            await tx.appointment_payment.upsert({
                where: { appointment_id: appointment.id },
                create: {
                    appointment_id: appointment.id,
                    amount: (session.amount_total || 0) / 100,
                    currency: session.currency || 'inr',
                    payment_method: session.payment_method_types?.[0] || 'card',
                    payment_status: resultStatus === 'SUCCESS' ? 'paid' : (session.payment_status || 'failed'),
                    receipt_url: receipt_url,
                    stripe_session_id: session.id
                },
                update: {
                    amount: (session.amount_total || 0) / 100,
                    currency: session.currency || 'inr',
                    payment_method: session.payment_method_types?.[0] || 'card',
                    payment_status: resultStatus === 'SUCCESS' ? 'paid' : (session.payment_status || 'failed'),
                    receipt_url: receipt_url,
                    stripe_session_id: session.id
                }
            });
            console.log(`✅ Success: Recorded appointment ${resultStatus} for ${email} via Webhook.`);
        });
    } catch (error) {
        console.error(`❌ Webhook Error processing appointment ${resultStatus} creation:`, error);
        throw error;
    }
}
