export interface IUpdateMedicalReportsReqBody {
    appointmentId: string;
    existing_reports?: string; // JSON string of report IDs to keep
}

export interface IUpdateMedicalReportsResponse {
    success: boolean;
    message: string;
}
