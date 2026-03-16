import { z } from 'zod';
import { DosageUnit, MealTiming } from '@prisma/client';

export const createPrescriptionSchema = z.object({
    params: z.object({
        appointmentId: z.string().uuid("Invalid appointment ID"),
    }),
    body: z.object({
        items: z.array(z.object({
            medicine_name: z.string().min(1, "Medicine name is required"),
            dosage_value: z.number().min(0.1, "Dosage value must be positive"),
            dosage_unit: z.nativeEnum(DosageUnit),
            morning: z.boolean().default(false),
            afternoon: z.boolean().default(false),
            night: z.boolean().default(false),
            timing: z.nativeEnum(MealTiming),
            total_quantity: z.number().int().min(1, "Total quantity must be at least 1"),
            note: z.string().optional(),
        })).min(1, "At least one prescription item is required"),
    }).refine((data) => {
        return data.items.every(item => item.morning || item.afternoon || item.night);
    }, {
        message: "Each item must have at least one schedule (morning, afternoon, or night) selected",
        path: ["items"],
    }),
});

export type ICreatePrescriptionRequest = z.infer<typeof createPrescriptionSchema>['body'];

export const updatePrescriptionSchema = createPrescriptionSchema;

export type IUpdatePrescriptionRequest = ICreatePrescriptionRequest;

export const getPrescriptionParamsSchema = z.object({
    params: z.object({
        appointmentId: z.string().uuid("Invalid appointment ID"),
    })
});
