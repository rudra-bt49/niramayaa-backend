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

    const generateForSegment = (segStart: number, segEnd: number) => {
        let currentStart = segStart;
        while (currentStart + slotDurationMs <= segEnd) {
            slots.push({
                start_time: new Date(currentStart),
                end_time: new Date(currentStart + slotDurationMs)
            });
            currentStart += slotDurationMs;
        }
    };

    if (breakStart && breakEnd) {
        // Segment 1: Before Break
        generateForSegment(startAt.getTime(), breakStart.getTime());
        // Segment 2: After Break
        generateForSegment(breakEnd.getTime(), endAt.getTime());
    } else {
        // No break, calculate for entire shift
        generateForSegment(startAt.getTime(), endAt.getTime());
    }

    return slots;
};
