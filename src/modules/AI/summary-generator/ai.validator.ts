import pdf from "pdf-parse";

export const aiValidator = {
  validatePDF: async (file: Express.Multer.File): Promise<void> => {
    const data = await pdf(file.buffer);

    if (data.numpages > 20) {
      throw new Error(
        `"${file.originalname}" exceeds the 20-page limit (found ${data.numpages} pages).`
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
