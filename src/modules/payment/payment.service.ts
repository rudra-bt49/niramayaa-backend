import prisma from "../../prisma/prisma";
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
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCompletedSubscription(event.data.object as any);
                break;
            case 'checkout.session.expired':
                console.log(`⚠️ Webhook: Session ${event.data.object.id} expired. Registration abandoned.`);
                break;
            case 'checkout.session.async_payment_failed':
                console.log(`❌ Webhook: Payment failed for session ${event.data.object.id}`);
                break;
            default:
                console.log(`ℹ️ Webhook: Unhandled event type ${event.type}`);
        }

        return { received: true };
    }
};

async function handleCompletedSubscription(session: any) {
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
                const paymentIntent = expandedSession.payment_intent as any;
                receipt_url = paymentIntent?.latest_charge?.receipt_url || null;
            } catch (err) {
                console.warn("⚠️ Webhook: Could not fetch receipt_url", err);
            }

            // 6. Record the payment
            await tx.subscription_payment.create({
                data: {
                    doctor_id: user.id,
                    plan_id: plan.id,
                    amount: session.amount_total / 100,
                    currency: session.currency,
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
                session.amount_total / 100,
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
