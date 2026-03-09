import express, { Router } from "express";
import { paymentController } from "./payment.controller";
import { API } from "../../shared/constants/api-routes";

const router = Router();

/**
 * @route   POST /api/payments/webhook
 * @desc    Stripe Webhook handler
 * @access  Public
 * 
 * IMPORTANT: This route uses express.raw() in the central router/app 
 * OR we can apply it specifically here if needed. 
 */
router.post(
    API.PAYMENT.WEBHOOK,
    paymentController.handleWebhook
);

export default router;
