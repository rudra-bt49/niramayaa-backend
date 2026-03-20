export const MODEL_NAME = "meta-llama/Llama-4-Scout-17B-16E-Instruct";

export const getValidationPrompt = (fileName: string, documentText: string, patientDescription: string) => `
You are a strict medical document validator. Return ONLY valid JSON, no extra text.

Check if the following document is a medical document.
Valid medical documents include: X-ray, MRI, CT scan, blood report, lab report, prescription, ECG, pathology report, radiology report, vaccination record, discharge summary.

If NOT a medical document, return exactly:
{"is_valid": false, "description": null}

If it IS a medical document, return exactly:
{"is_valid": true, "description": "<2-3 sentence summary useful for a doctor. No diagnosis. No treatment advice. State document type, key findings, and relevance to patient symptoms if any.>"}

Patient Symptoms: ${patientDescription || "Not provided"}
Document Name: ${fileName}
Document Content:
${documentText}

Return JSON only.`;

export const getSummaryPrompt = (contextBlock: string) => `
You are an Elite Medical Consultant preparing a high-impact briefing for a physician. 
Objective: Synthesize the context into a professional, clinical summary.

Instructions:
1. Tone: Maintain a strict, professional, and staccato clinical tone. 
2. Content: Prioritize quantifiable laboratory values, imaging findings, and documented clinical history.
3. INCOHERENCE RULE: If no medical records are present and the patient's reported symptoms are nonsensical or have zero medical relevance (e.g., gibberish, letters, or unrelated conversational text), return ONLY a single brief sentence: "Reported symptoms are non-medical or incoherent; no clinical records available." Do NOT provide meta-commentary on why an assessment cannot be performed.
4. OMISSION RULE: If a data type (e.g., Lab results, Imaging, History) is completely missing from the context, do NOT mention it at all. Do NOT state "Not provided" or "No information available" for missing categories.
5. Professionalism: Use medical shorthand where appropriate (e.g., h/o, s/p). Avoid polite filler or conversational filler text. 
6. Restriction: Never provide a diagnosis or treatment recommendations. 

Context Data:
${contextBlock}
Return plain text only. No JSON. No bullet points.Professional clinical summary (3-5 sentences).`;
