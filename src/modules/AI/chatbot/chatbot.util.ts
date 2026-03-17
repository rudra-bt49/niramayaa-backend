import { ExtractedPatientDetails } from "./chatbot.types";

/**
 * Removes null, undefined, or empty string values from the LLM extraction
 * so we don't accidentally overwrite previously collected good data.
 */
export const cleanExtractedData = (rawExtraction: any): Partial<ExtractedPatientDetails> => {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(rawExtraction || {})) {
        if (value !== undefined && value !== null && value !== "") {
            cleaned[key] = value;
        }
    }
    return cleaned;
};