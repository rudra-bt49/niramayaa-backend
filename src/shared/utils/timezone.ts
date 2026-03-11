export const convertUtcToIstDate = (utcDate: Date | null): Date | null => {
    if (!utcDate) return null;

    // We get a Date object representing UTC from Prisma.
    // To present IST (+5:30) correctly to the frontend as an ISO string or Date,
    // we shift the underlying time value by adding 5 hours and 30 minutes.
    const istOffsetInMs = (5 * 60 + 30) * 60 * 1000;

    return new Date(utcDate.getTime() + istOffsetInMs);
};

export interface TimeSlot {
    start_time: Date;
    end_time: Date;
}

export const generateSlots = (
    startAt: Date,
    endAt: Date,
    breakStart: Date | null,
    breakEnd: Date | null,
    slotDurationMinutes: number
): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const slotDurationMs = slotDurationMinutes * 60 * 1000;

    let currentStart = startAt.getTime();
    const end = endAt.getTime();

    while (currentStart + slotDurationMs <= end) {
        const currentEnd = currentStart + slotDurationMs;

        // Check if the current slot overlaps with the break time
        let isBreakOverlap = false;
        if (breakStart && breakEnd) {
            const bStart = breakStart.getTime();
            const bEnd = breakEnd.getTime();
            // A slot overlaps if it starts before break ends AND ends after break starts
            if (currentStart < bEnd && currentEnd > bStart) {
                isBreakOverlap = true;
            }
        }

        if (!isBreakOverlap) {
            slots.push({
                start_time: new Date(currentStart),
                end_time: new Date(currentEnd)
            });
        }

        currentStart = currentEnd;
    }

    return slots;
};
