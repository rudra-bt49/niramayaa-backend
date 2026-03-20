import prisma from '../../prisma/prisma';
import { AppointmentStatus } from '@prisma/client';
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
                // Check if any scheduled appointments exist before making inactive
                const bookedAppointments = await prisma.appointment.findMany({
                    where: {
                        availability_id: existingRecord.id,
                        status: AppointmentStatus.SCHEDULED
                    }
                });

                if (bookedAppointments.length > 0) {
                    throw new Error(`Cannot mark ${dateStr} as inactive because there are ${bookedAppointments.length} scheduled appointments.`);
                }

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

                // 1. Fetch appointments to validate constraints
                const bookedAppointments = await prisma.appointment.findMany({
                    where: {
                        availability_id: existingRecord.id,
                        NOT: { status: AppointmentStatus.PAYMENT_FAILED }
                    }
                });

                // 2. Lock slot_duration if appointments are SCHEDULED
                const hasScheduled = bookedAppointments.some(a => a.status === AppointmentStatus.SCHEDULED);
                if (hasScheduled && slotDurationMin !== existingRecord.slot_duration) {
                    throw new Error(`Cannot change slot duration for ${dateStr} as there are scheduled appointments.`);
                }

                // 3. Past Time Constraints (Today Only)
                const now = new Date();
                const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
                const todayStr = istNow.toISOString().split('T')[0];

                const parseTime = (t: string) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                };

                const getIstMins = (d: Date) => {
                    const istDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
                    return istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
                };

                if (dateStr === todayStr) {
                    const currentMins = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

                    const oldStartMins = getIstMins(existingRecord.start_at);
                    const oldEndMins = getIstMins(existingRecord.end_at);
                    const oldBStartMins = existingRecord.break_start ? getIstMins(existingRecord.break_start) : null;
                    const oldBEndMins = existingRecord.break_end ? getIstMins(existingRecord.break_end) : null;

                    if (oldStartMins < currentMins && parseTime(startAtStr) !== oldStartMins) throw new Error("Shift start has already passed.");
                    if (oldEndMins < currentMins && parseTime(endAtStr) !== oldEndMins) throw new Error("Shift end has already passed.");
                    if (oldBStartMins && oldBStartMins < currentMins && parseTime(breakStartStr) !== oldBStartMins) throw new Error("Break start has already passed.");
                    if (oldBEndMins && oldBEndMins < currentMins && parseTime(breakEndStr) !== oldBEndMins) throw new Error("Break end has already passed.");
                }

                // 4. Validate clashes with existing bookings
                const newStartMins = parseTime(startAtStr);
                const newEndMins = parseTime(endAtStr);
                const newBStartMins = parseTime(breakStartStr);
                const newBEndMins = parseTime(breakEndStr);

                for (const appt of bookedAppointments) {
                    const apptStartMins = getIstMins(appt.start_at);
                    const apptEndMins = getIstMins(appt.end_at);

                    // Must be within work hours
                    if (apptStartMins < newStartMins || apptEndMins > newEndMins) {
                        const timeStr = appt.start_at.toISOString().split('T')[1].substring(0, 5);
                        throw new Error(`Timing clash: appointment exists at ${timeStr} IST for ${dateStr}.`);
                    }

                    // Must NOT be in the break
                    if (!(apptEndMins <= newBStartMins || apptStartMins >= newBEndMins)) {
                        const timeStr = appt.start_at.toISOString().split('T')[1].substring(0, 5);
                        throw new Error(`Break clash: appointment exists at ${timeStr} IST for ${dateStr}.`);
                    }
                }

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
