"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL_NAME = process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-2.5-pro";

const genAI = new GoogleGenerativeAI(API_KEY);

const DEFAULT_SYSTEM_PROMPT = `
You are a friendly conversation partner.
Start response with [neutral], [joy], [angry], [sorrow], [fun].
You MUST speak in Japanese.
Keep it short and natural.
`;

const SUPPORT_SYSTEM_PROMPT = `
あなたは会話のサポーターです。
ユーザーの発言に対して、文脈や感情を分析し、会話を盛り上げるための短いコメントや、感情のラベル付けを行ってください。
厳密な修正は不要です。ユーザーを肯定してください。

Output strictly in JSON format:
{
  "hasError": false,
  "corrected": "N/A",
  "reason": "ユーザーへの短い共感コメント（日本語、最大20文字）"
}
`;

// Helper to sanitize AI JSON output (removes markdown code blocks)
function cleanJsonOutput(text: string): string {
    return text.replace(/```json\s*|\s*```/g, "").trim();
}

export async function chatWithGemini(
    message: string,
    history: { role: "user" | "model", parts: string }[],
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT
) {
    try {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: systemPrompt,
        });

        const recentHistory = history.slice(-10);

        const chat = model.startChat({
            history: recentHistory.map(h => ({
                role: h.role,
                parts: [{ text: h.parts }]
            })),
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();

        // 1. Extract Primary Emotion (Start of string)
        let emotion = "neutral";
        let cleanText = response;

        const match = response.match(/^[\[\(](neutral|joy|happy|fun|angry|sorrow|sad|surprised|relaxed)[\]\)]\s*([\s\S]*)/i);

        if (match) {
            emotion = match[1].toLowerCase();
            if (emotion === 'happy') emotion = 'joy';
            if (emotion === 'sad') emotion = 'sorrow';
            cleanText = match[2].trim();
        } else {
            // Try to remove any leading bracket if it looks like an emotion but wasn't caught strictly
             cleanText = response.replace(/^[\[\(].*?[\]\)]\s*/, "").trim();
        }

        // 2. Global Cleanup: Remove ANY remaining [tag] or (tag) from the text body
        // This prevents "こんにちは [smile]" from showing/speaking "[smile]"
        cleanText = cleanText.replace(/[\[\(].*?[\]\)]/g, "").trim();

        return {
            emotion: emotion,
            text: cleanText
        };

    } catch (error) {
        console.error("Gemini Chat Error:", error);
        return {
            emotion: "sorrow",
            text: "思考回路に接続できません..."
        };
    }
}

export async function analyzeGrammar(text: string) {
    try {
        // Fallback to primary model if Flash is not available/configured
        const modelName = "gemini-2.0-flash";

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: SUPPORT_SYSTEM_PROMPT,
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(text);
        const rawText = result.response.text();
        const json = JSON.parse(cleanJsonOutput(rawText));
        return json;
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        // Fallback for UI safety
        return { hasError: false, reason: "..." };
    }
}
