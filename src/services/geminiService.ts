import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

const getGenAI = () => {
  if (genAI) return genAI;
  // Use import.meta.env for environment variables in Vite
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn("Gemini API Key não configurada. Funções de IA estarão desativadas.");
    return null;
  }
  genAI = new GoogleGenAI({ apiKey });
  return genAI;
};

export const editCarImage = async (base64Image: string, prompt: string) => {
  const ai = getGenAI();
  if (!ai) throw new Error("Recurso de IA desativado. Chave de API não configurada.");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
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
      ],
    });

    const result = response.candidates?.[0]?.content;
    if (result) {
      for (const part of result.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("Nenhuma imagem foi gerada pelo Gemini.");
  } catch (error) {
    console.error("Erro ao editar imagem com Gemini:", error);
    throw error;
  }
};

export const fetchVehicleSpecs = async (brand: string, model: string, year: string, spec?: string) => {
  const ai = getGenAI();
  if (!ai) throw new Error("Recurso de IA desativado.");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          parts: [
            {
              text: `You are a technical automotive data expert. Provide original factory specs for: ${brand} ${model} ${year}${spec ? ' version ' + spec : ''}. 
              Focus on Brazilian market specifications if applicable.
              Response MUST be only valid JSON in this format: {"hp": number, "torque": number, "weight": number}. 
              Use CV for horsepower, kgfm for torque, and kg for weight. If unsure, provide mid-range estimates. Do NOT include any markdown or extra text.`,
            },
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Clean JSON if needed (some models might wrap it in ```json)
    const jsonStr = text.replace(/```json|```|json/g, '').trim();
    if (!jsonStr) throw new Error("IA retornou resposta vazia.");
    return JSON.parse(jsonStr) as { hp: number, torque: number, weight: number };
  } catch (error) {
    console.error("Error fetching specs with Gemini:", error);
    throw new Error("Não foi possível buscar os dados técnicos automaticamente.");
  }
};
