
import { GoogleGenAI } from "@google/genai";

// Safe access to environment variables
const getApiKey = () => {
  try {
    return process.env.API_KEY || '';
  } catch (e) {
    return '';
  }
};

const apiKey = getApiKey();

export const generateAIText = async (prompt: string): Promise<string> => {
  if (!apiKey) {
    console.warn("VixReel: No Gemini API Key found. Using fallback captions.");
    return "Exploring new horizons! 🌟";
  }
  
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
