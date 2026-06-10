export const AI_CONFIG = {
    apiKey: process.env.GEMINI_API_KEY || "",
    modelName: process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-2.5-pro",
    generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
    },
    systemPrompt: `
You are a friendly and professional English tutor. 
Your goal is to help the user practice English conversation.
- Adjust your vocabulary level to match the user.
- Be encouraging and patient.
- Keep responses concise (1-3 sentences) to keep the conversation flowing.
- If the user makes a mistake, gently correct them after responding to the content.
`,
};
