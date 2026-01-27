
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

export const generateAIText = async (prompt: string): Promise<string> => {
  if (!apiKey) return "AI Caption: Could not connect to Gemini API.";
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a social media trend expert. Create engaging, short, and trendy Instagram-style captions with 2-3 relevant emojis based on the user's description. Keep it under 20 words.",
        temperature: 0.8,
      }
    });
    
    return response.text || "Vibing with VixReel! 🚀✨";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Exploring new horizons! 🌟";
  }
};
