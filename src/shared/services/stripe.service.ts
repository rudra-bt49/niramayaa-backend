import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-01-27.acacia' as any, // Using latest stable
});

class StripeService {
    /**
     * Create a Checkout Session for doctor subscription
     */
    async createCheckoutSession(params: {
        doctorEmail: string;
        planName: string;
        amount: number;
        successUrl: string;
        cancelUrl: string;
        metadata: Record<string, string>;
    }) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is missing in backend .env file');
        }

        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'inr',
                            product_data: {
                                name: `Niramayaa ${params.planName} Subscription`,
                                description: `Full registration for Dr. ${params.doctorEmail}`,
                            },
                            unit_amount: Math.round(params.amount * 100),
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                customer_email: params.doctorEmail,
                success_url: params.successUrl,
                cancel_url: params.cancelUrl,
                metadata: params.metadata,
            });

            return session;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown Stripe error';
            console.error('Stripe Session Creation Error:', errorMessage);
            throw error;
        }
    }

    /**
     * Retrieve full session details including payment intent
     */
    async getSessionDetails(sessionId: string) {
        return await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent.latest_charge'],
        });
    }

    /**
     * Verify Stripe Webhook Signature
     */
    verifyWebhook(payload: string | Buffer, signature: string, secret: string) {
        try {
            return stripe.webhooks.constructEvent(payload, signature, secret);
        } catch (error) {
            console.error('Stripe Webhook Verification Error:', error);
            throw new Error('Invalid webhook signature');
        }
    }
}

export const stripeService = new StripeService();
