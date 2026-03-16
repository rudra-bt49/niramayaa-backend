import { PDFParse } from "pdf-parse";

export const aiValidator = {
  validatePDF: async (file: Express.Multer.File): Promise<void> => {
    const parser = new (PDFParse as any)({ data: file.buffer });
    const info = await parser.getInfo();
    await parser.destroy();

    if (info.total > 20) {
      throw new Error(
        `"${file.originalname}" exceeds the 20-page limit (found ${info.total} pages).`
      );
    }
  },

  validateDocumentCount: (files: Express.Multer.File[]): void => {
    if (files.length > 5) {
      throw new Error("Maximum 5 documents allowed per appointment.");
    }
  }
};



// I'll refine the validator once I'm sure about the pdf-parse API in the installed version.
// For now, let's make a generic one.
