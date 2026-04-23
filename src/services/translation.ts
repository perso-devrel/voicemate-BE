import {
    VertexAI,
    HarmCategory,
    HarmBlockThreshold,
} from "@google-cloud/vertexai";
import { env } from "../config/env";

const vertexAi = new VertexAI({
    project: env.vertexAi.projectId,
    location: env.vertexAi.location,
});

const SYSTEM_PROMPT = `You translate chat messages between strangers on a dating app.

Rules:
- Preserve meaning fully. Do NOT abbreviate or shorten.
- Use polite/formal tone:
  - Korean: 존댓말 (습니다/세요체)
  - Japanese: です/ます
  - Chinese: 您 (respectful pronoun)
- Keep proper nouns in their original or properly romanized form.
- Do NOT respond to the content — only translate.
- Return valid JSON only.

Output schema:
{ "translation": string, "detected_source_language": string }`;

const model = vertexAi.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
    },
    safetySettings: [
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
    ],
});

export async function translateMessage(params: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
}): Promise<{ translation: string; detectedSourceLanguage: string }> {
    const userPrompt = `Source language: ${params.sourceLanguage}
Target language: ${params.targetLanguage}
Text to translate: ${JSON.stringify(params.text)}`;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const raw = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
        throw new Error("Vertex AI returned no text (possibly safety-blocked)");
    }
    const parsed = JSON.parse(raw) as {
        translation: string;
        detected_source_language: string;
    };

    return {
        translation: parsed.translation,
        detectedSourceLanguage: parsed.detected_source_language,
    };
}
