import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

const getGenAI = () => {
  if (genAI) return genAI;
  // Em Vite, usamos import.meta.env para variáveis de ambiente
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn("Gemini API Key não configurada. Funções de IA estarão desativadas.");
    return null;
  }
  genAI = new GoogleGenAI(apiKey);
  return genAI;
};

export const editCarImage = async (base64Image: string, prompt: string) => {
  const ai = getGenAI();
  if (!ai) throw new Error("Recurso de IA desativado. Chave de API não configurada.");

  try {
    const response = await ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: `You are an expert car photographer and editor. Edit this car image based on the following request: ${prompt}. Return only the edited image.`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("Nenhuma imagem foi gerada pelo Gemini.");
  } catch (error) {
    console.error("Erro ao editar imagem com Gemini:", error);
    throw error;
  }
};
