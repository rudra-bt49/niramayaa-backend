import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { paymentService } from "./payment.service";

export const paymentController = {
    handleWebhook: asyncHandler(async (req: Request, res: Response) => {
        const sig = req.headers['stripe-signature'] as string;

        if (!sig) {
            res.status(400).send("Webhook Error: Missing stripe-signature");
            return;
        }

        const result = await paymentService.handleWebhook((req as any).rawBody, sig);
        res.status(200).json(result);
    })
};
