
import { GoogleGenAI, Type } from "@google/genai";
import { Resource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

/**
 * 使用语义理解搜索集合（作为 MeiliSearch 的补充或备选语义方案）。
 */
export const semanticSearch = async (
  query: string,
  resources: Resource[]
): Promise<string[]> => {
  if (!query || resources.length === 0) return resources.map(r => r.id);

  const resourceMap = resources.map(r => ({ id: r.id, name: r.name, category: r.metadata.category }));
  const prompt = `
    搜索查询: "${query}"
    数据库内容: ${JSON.stringify(resourceMap)}
    
    请根据语义识别最相关的资源 ID，并按相关性排序。
    重点关注语义匹配（例如：如果查询是“自然”，应匹配“树木”、“河流”、“森林”）。
    仅返回 ID 数组。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ids: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{\"ids\":[]}");
    return result.ids || [];
  } catch (error) {
    console.error("语义搜索错误:", error);
    return resources.map(r => r.id);
  }
};
