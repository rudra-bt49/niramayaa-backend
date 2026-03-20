import { Receiver } from "@upstash/qstash";
import axios from 'axios';

export const qstashService = {
    /**
     * Publishes a message to QStash to be delivered to our webhook.
     */
    publishToQueue: async (data: any) => {
        const publishBase = process.env.QSTASH_PUBLISH_URL || 'https://qstash.upstash.io';
        const QSTASH_URL = `${publishBase}/v2/publish/${process.env.QSTASH_DESTINATION_URL}`;
        const QSTASH_TOKEN = process.env.QSTASH_TOKEN;

        try {
            const response = await axios.post(QSTASH_URL, data, {
                headers: {
                    'Authorization': `Bearer ${QSTASH_TOKEN}`,
                    'Content-Type': 'application/json',
                    // Optional: Retries, delays etc can be added as Upstash headers
                    'Upstash-Retries': '3',
                }
            });
            console.log('✅ Published to QStash:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('❌ Failed to publish to QStash:', error.response?.data || error.message);
            throw new Error('Queue processing failed');
        }
    },

    /**
     * Verifies if the incoming request is actually from Upstash QStash.
     */
    verifySignature: async (body: string, signature: string) => {
        const receiver = new Receiver({
            currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
            nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
        });

        try {
            const isValid = await receiver.verify({
                body,
                signature,
            });
            return isValid;
        } catch (error) {
            console.error('❌ QStash signature verification failed');
            return false;
        }
    }
};
