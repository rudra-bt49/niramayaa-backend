export interface UpdateAvailabilityReqBody {
    dates: string[]; // Array of dates in "YYYY-MM-DD" format
    is_active: boolean;
    start_at?: string; // "HH:MM" in 24-hr format (IST)
    end_at?: string; // "HH:MM" in 24-hr format (IST)
    break_start?: string; // "HH:MM" in 24-hr format (IST)
    break_end?: string; // "HH:MM" in 24-hr format (IST)
    slot_duration?: number; // in minutes
}
