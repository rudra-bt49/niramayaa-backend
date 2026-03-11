import prisma from '../../prisma/prisma';
import { UpdateAvailabilityReqBody } from './availability.types';
import { generateSlots } from '../../shared/utils/timezone';

export class AvailabilityService {
    public updateAvailability = async (doctorId: string, body: UpdateAvailabilityReqBody) => {
        const { dates, is_active, start_at, end_at, break_start, break_end, slot_duration } = body;

        // Ensure doctor exists
        const doctor = await prisma.doctor_profile.findUnique({
            where: { user_id: doctorId }
        });

        if (!doctor) {
            throw new Error("Doctor profile not found");
        }

        const results: any[] = [];

        for (const dateStr of dates) {
            // dateStr is 'YYYY-MM-DD' representing IST date
            const [yearStr, monthStr, dayStr] = dateStr.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10) - 1; // 0-indexed
            const date = parseInt(dayStr, 10);

            // Calculate start and end of that date in IST, then convert to UTC
            // IST 00:00:00 is UTC previous day 18:30:00
            const istStartOfDay = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
            const utcRangeStart = new Date(istStartOfDay.getTime() - (5.5 * 60 * 60 * 1000));
            
            // IST 23:59:59.999 
            const istEndOfDay = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
            const utcRangeEnd = new Date(istEndOfDay.getTime() - (5.5 * 60 * 60 * 1000));

            // Find the availability record for this date
            const existingRecord = await prisma.availability.findFirst({
                where: {
                    doctor_id: doctorId,
                    start_at: {
                        gte: utcRangeStart,
                        lte: utcRangeEnd
                    }
                }
            });

            if (!existingRecord) {
                results.push({ date: dateStr, status: 'Not found', message: `No availability record found for ${dateStr}` });
                continue;
            }

            if (!is_active) {
                // Just update is_active to false
                await prisma.availability.update({
                    where: { id: existingRecord.id },
                    data: { is_active: false }
                });
                results.push({ date: dateStr, status: 'Updated successfully (Inactive)' });
            } else {
                // Safely assert these exist since validator ensured they do when is_active is true
                const startAtStr = start_at as string;
                const endAtStr = end_at as string;
                const breakStartStr = break_start as string;
                const breakEndStr = break_end as string;
                const slotDurationMin = slot_duration as number;

                // Create helper to convert "HH:MM" on this date to correct UTC Date object
                const createUtcDateTime = (timeStr: string) => {
                    const [hoursStr, minutesStr] = timeStr.split(':');
                    const hours = parseInt(hoursStr, 10);
                    const minutes = parseInt(minutesStr, 10);

                    // We treat the inputs as IST. So year, month, date from dateStr + HH, MM
                    // We construct a fake UTC date string, then subtract 5.5 hours to get real UTC
                    const tempIst = new Date(Date.UTC(year, month, date, hours, minutes, 0, 0));
                    return new Date(tempIst.getTime() - (5.5 * 60 * 60 * 1000));
                };

                const startAtUTC = createUtcDateTime(startAtStr);
                const endAtUTC = createUtcDateTime(endAtStr);
                const breakStartUTC = createUtcDateTime(breakStartStr);
                const breakEndUTC = createUtcDateTime(breakEndStr);

                // Calculate queue capacity by generating slots using the existing timezone utility
                const slots = generateSlots(startAtUTC, endAtUTC, breakStartUTC, breakEndUTC, slotDurationMin);
                const queueCapacity = slots.length;

                // Update the record
                await prisma.availability.update({
                    where: { id: existingRecord.id },
                    data: {
                        is_active: true,
                        start_at: startAtUTC,
                        end_at: endAtUTC,
                        break_start: breakStartUTC,
                        break_end: breakEndUTC,
                        slot_duration: slotDurationMin,
                        queue_capacity: queueCapacity
                    }
                });

                results.push({ date: dateStr, status: 'Updated successfully (Active)', queueCapacity });
            }
        }

        return results;
    };
}

export const availabilityService = new AvailabilityService();
