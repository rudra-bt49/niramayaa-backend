import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24-hour format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD format

export const updateAvailabilitySchema = z.object({
    body: z.object({
        dates: z.array(z.string().regex(dateRegex, "Each date must be in YYYY-MM-DD format"))
            .min(1, "At least one date must be provided"),
        is_active: z.boolean(),
        start_at: z.string().regex(timeRegex, "Invalid start_at format. Use HH:MM in 24-hour format").optional(),
        end_at: z.string().regex(timeRegex, "Invalid end_at format. Use HH:MM in 24-hour format").optional(),
        break_start: z.string().regex(timeRegex, "Invalid break_start format. Use HH:MM in 24-hour format").optional(),
        break_end: z.string().regex(timeRegex, "Invalid break_end format. Use HH:MM in 24-hour format").optional(),
        slot_duration: z.number().int().positive("Slot duration must be a positive integer in minutes").optional(),
    }).superRefine((data, ctx) => {
        if (!data.is_active) {
            // If is_active is false, no other fields should be present
            const forbiddenFields = ['start_at', 'end_at', 'break_start', 'break_end', 'slot_duration'];
            for (const field of forbiddenFields) {
                if (data[field as keyof typeof data] !== undefined) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `${field} should not be provided when is_active is false`,
                        path: [field],
                    });
                }
            }
        } else {
            // If is_active is true, all other fields are required
            const requiredFields = ['start_at', 'end_at', 'break_start', 'break_end', 'slot_duration'];
            for (const field of requiredFields) {
                if (data[field as keyof typeof data] === undefined) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `${field} is required when is_active is true`,
                        path: [field],
                    });
                }
            }

            // Time logic validations if fields are present
            if (data.start_at && data.end_at && data.break_start && data.break_end && data.slot_duration) {
                const parseTime = (timeStr: string) => {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    return hours * 60 + minutes; // returns total minutes from midnight
                };

                const startMins = parseTime(data.start_at);
                const endMins = parseTime(data.end_at);
                const breakStartMins = parseTime(data.break_start);
                const breakEndMins = parseTime(data.break_end);

                if (startMins >= endMins) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "start_at must be less than end_at",
                        path: ['start_at'],
                    });
                }

                if (breakStartMins >= breakEndMins) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "break_start must be less than break_end",
                        path: ['break_start'],
                    });
                }

                if (breakStartMins <= startMins || breakEndMins >= endMins) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Break must be strictly within working hours (cannot start at shift start or end at shift end)",
                        path: ['break_start'],
                    });
                }

                const durationBeforeBreak = breakStartMins - startMins;
                const durationAfterBreak = endMins - breakEndMins;
                const maxSlotDuration = Math.min(durationBeforeBreak, durationAfterBreak);

                if (data.slot_duration > maxSlotDuration) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `slot_duration cannot exceed maximum continuous working segment (${maxSlotDuration} min)`,
                        path: ['slot_duration'],
                    });
                }
            }
        }
    })
});
