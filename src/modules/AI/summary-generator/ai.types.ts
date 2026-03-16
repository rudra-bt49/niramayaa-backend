export interface DocumentResult {
  file_name: string;
  is_valid: boolean;
  description: string | null;
}

export interface SummarizeResponse {
  success: boolean;
  documents?: DocumentResult[];
  ai_summary?: string | null;
  error?: string;
}

export interface DocumentValidationResult {
  is_valid: boolean;
  description: string | null;
}
