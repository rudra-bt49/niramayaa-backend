import { InferenceClient } from "@huggingface/inference";
import pdf from "pdf-parse";
import { MODEL_NAME, getValidationPrompt, getSummaryPrompt } from "./ai.prompts";
import { DocumentValidationResult, DocumentResult } from "./ai.types";

const hf = new InferenceClient(process.env.HF_TOKEN);

export const aiService = {
  extractFileText: async (file: Express.Multer.File): Promise<string> => {
    if (file.mimetype === "application/pdf") {
      const data = await pdf(file.buffer);
      return data.text;
    }
    return `[Image file: ${file.originalname}]`;
  },


  validateDocument: async (
    fileName: string,
    documentText: string,
    patientDescription: string
  ): Promise<DocumentValidationResult> => {
    const prompt = getValidationPrompt(fileName, documentText, patientDescription);

    try {
      const response = await hf.chatCompletion({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: "You are a medical document validator. Always return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0,
        max_tokens: 300
      });

      const raw = response.choices[0].message.content ?? "";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error(`AI Validation Error for ${fileName}:`, error);
      return { is_valid: false, description: null };
    }
  },

  generateAISummary: async (
    validDocSummaries: string[],
    patientDescription: string
  ): Promise<string> => {
    const hasValidDocs = validDocSummaries.length > 0;

    let contextBlock = "";
    if (hasValidDocs) {
      contextBlock += `Medical Documents:\n${validDocSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`;
    }
    if (patientDescription.trim()) {
      contextBlock += `Patient Reported Symptoms: ${patientDescription}\n`;
    }

    const prompt = getSummaryPrompt(contextBlock);

    try {
      const response = await hf.chatCompletion({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: "You are a medical assistant. Write concise doctor briefings." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 300
      });

      return response.choices[0].message.content?.trim() ?? "";
    } catch (error) {
      console.error("AI Summary Generation Error:", error);
      return "";
    }
  },

  processDocuments: async (files: Express.Multer.File[], patientDescription: string) => {
    // Parallel processing for all documents
    const processPromises = files.map(async (file) => {
      const text = await aiService.extractFileText(file);
      const llmResult = await aiService.validateDocument(file.originalname, text, patientDescription);

      return {
        file,
        documentResult: {
          file_name: file.originalname,
          is_valid: llmResult.is_valid,
          description: llmResult.description
        }
      };
    });

    const results = await Promise.all(processPromises);

    const documents: DocumentResult[] = [];
    const validDocDescriptions: string[] = [];
    const validFiles: Express.Multer.File[] = [];

    for (const result of results) {
      documents.push(result.documentResult);
      if (result.documentResult.is_valid) {
        validFiles.push(result.file);
        if (result.documentResult.description) {
          validDocDescriptions.push(`${result.documentResult.file_name}: ${result.documentResult.description}`);
        }
      }
    }


    const hasValidDocs = validDocDescriptions.length > 0;
    const hasDescription = patientDescription.trim().length > 0;

    let ai_summary: string | null = null;
    if (hasValidDocs || hasDescription) {
      ai_summary = await aiService.generateAISummary(
        hasValidDocs ? validDocDescriptions : [],
        patientDescription
      );
    }

    return {
      documents,
      ai_summary,
      validFiles
    };
  }
};
