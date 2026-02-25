
import { GoogleGenAI } from "@google/genai";

/**
 * Generates an engaging social media caption using the Gemini 3 Flash model.
 * Complies with @google/genai guidelines: fresh instance creation, direct text property access,
 * and environment variable usage.
 */
export const generateAIText = async (prompt: string): Promise<string> => {
  try {
    // Initializing the GenAI client using process.env.API_KEY directly as required.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-3-flash-preview for basic text generation tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a social media trend expert. Create engaging, short, and trendy Instagram-style captions with 2-3 relevant emojis based on the user's description. Keep it under 20 words.",
        temperature: 0.8,
      }
    });
    
    // Extracting text directly from the response property (not as a method).
    return response.text || "Vibing with VixReel! 🚀✨";
  } catch (error) {
    console.error("Gemini Error:", error);
    // Graceful fallback for API errors.
    return "Exploring new horizons! 🌟";
  }
};

/**
 * Generates an image based on a prompt using gemini-2.5-flash-image.
 */
export const generateAIImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ text: prompt }],
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Error:", error);
    return null;
  }
};
