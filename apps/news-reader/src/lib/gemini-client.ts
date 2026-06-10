import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_NEWS_API_KEY || process.env.GEMINI_API_KEY || "";

if (!API_KEY) {
    console.warn("WARN: GEMINI_NEWS_API_KEY is not set. AI features will not work.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export interface AIAnalysisResult {
    summary: string;
    priority: 'High' | 'Medium' | 'Low';
    topics: string[];
    sentiment: 'Positive' | 'Negative' | 'Neutral';
}

export const analyzeArticle = async (title: string, content: string): Promise<AIAnalysisResult | null> => {
    if (!API_KEY) return null;

    const prompt = `
  You are a news analyst. Analyze the following article and provide a JSON response.
  
  Article Title: ${title}
  Article Content: ${content.substring(0, 1000)}... (truncated)

  Required JSON Format:
  {
    "summary": "3 bullet points summary in Japanese",
    "priority": "High/Medium/Low (based on general impact)",
    "topics": ["topic1", "topic2"],
    "sentiment": "Positive/Negative/Neutral"
  }
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Simple JSON extraction (robust enough for Flash typically)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        return JSON.parse(jsonMatch[0]) as AIAnalysisResult;
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return null;
    }
};
