export const convertUtcToIstDate = (utcDate: Date | null): Date | null => {
    if (!utcDate) return null;

    // We get a Date object representing UTC from Prisma.
    // To present IST (+5:30) correctly to the frontend as an ISO string or Date,
    // we shift the underlying time value by adding 5 hours and 30 minutes.
    const istOffsetInMs = (5 * 60 + 30) * 60 * 1000;

    return new Date(utcDate.getTime() + istOffsetInMs);
};

export const calculateAge = (dob: string | Date) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

/**
 * Converts IST time string to a UTC Date object relative to a base date.
 * @param timeStr Time string in HH:MM format.
 * @param baseDate The date from which to take year, month, and day (in IST).
 * @returns UTC Date object.
 */
export const convertISTToUTC = (timeStr: string, baseDate: Date): Date => {
    const istOffsetInMs = (5 * 60 + 30) * 60 * 1000;
    
    // Convert baseDate to IST to correctly extract the IST year, month, and day
    const istDate = new Date(baseDate.getTime() + istOffsetInMs);
    const year = istDate.getUTCFullYear();
    const month = istDate.getUTCMonth(); 
    const day = istDate.getUTCDate();

    // Determine the target time components
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Create timestamp as if it were UTC, then subtract offset to get actual UTC
    const istTimestamp = Date.UTC(year, month, day, hours, minutes, 0, 0);
    return new Date(istTimestamp - istOffsetInMs);
};

/**
 * Converts a full IST ISO string (even if it lacks offset) to a UTC Date object.
 * Assumes the input string represents IST time.
 */
export const convertIstToUtc = (isoStr: string): Date => {
    const istOffsetInMs = (5 * 60 + 30) * 60 * 1000;
    
    // Normalize string: if it doesn't have a timezone, treat it as UTC temporarily to get base value
    let normalizedIso = isoStr;
    if (!isoStr.endsWith('Z') && !isoStr.includes('+') && !isoStr.includes('-')) {
        normalizedIso += 'Z';
    }
    
    const utcDate = new Date(normalizedIso);
    // Subtract 5:30 to get the actual UTC time representing that IST value
    return new Date(utcDate.getTime() - istOffsetInMs);
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
