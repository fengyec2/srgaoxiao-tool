import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client on the server
let aiClient: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY process env is not configured. Please set it in Vercel environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "srgaoxiao-tool",
        },
      },
    });
  }
  return aiClient;
}

// Single school summarization
export async function summarizeSingle(schoolName: string, comments: string[], customPrompt?: string) {
  if (!schoolName) {
    throw new Error("学校名称不能为空");
  }

  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    return { summary: "未发现相关吐槽或曝光记录" };
  }

  try {
    const ai = getAiClient();
    const instruction = customPrompt || `你是一个高校舆情和吐槽曝光评论的分析专家。请合并和分析这些吐槽，写出一个极其简明扼要的槽点总结。`;
    const prompt = `${instruction}
下面是关于【${schoolName}】这所大学被网友吐槽和评论的内容：
---
${comments.map((c, idx) => `[评论 ${idx + 1}]: ${c}`).join("\n\n")}
---

约束条件：
1. 字数在 60 字以内。
2. 语气客观中立，避开主观评价（字数决不能超出 60 个字）。
3. 如果评论都是水贴或无意义内容，直接概括写"未见实质吐槽"。`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const summary = response.text ? response.text.trim() : "无负面舆情总结";
    return { summary };
  } catch (error: any) {
    console.error(`AI Summarization failed for ${schoolName}:`, error);
    const errString = String(error.message || error);
    if (
      errString.includes("429") ||
      errString.toLowerCase().includes("quota") ||
      errString.toLowerCase().includes("limit") ||
      errString.toLowerCase().includes("resource_exhausted")
    ) {
      return {
        summary: "免费API额度已满，启动降级备注",
        isQuotaExceeded: true
      };
    }
    throw new Error(`AI 总结失败: ${error.message || error}`);
  }
}

// Batch summarization
export async function summarizeBatch(schools: Array<{ name: string; comments: string[] }>, customPrompt?: string) {
  if (!schools || !Array.isArray(schools) || schools.length === 0) {
    throw new Error("学校列表不能为空");
  }

  try {
    const ai = getAiClient();
    
    // Structure input data for Gemini to see
    const promptInput = schools.map(s => ({
      schoolName: s.name,
      comments: (s.comments || []).slice(0, 15)
    }));

    const baseInstruction = customPrompt?.trim() || `你是一个中国高校舆情和网友曝光评论的深度总结专家。
现在，有 ${schools.length} 所高校的吐槽和爆料评论列表。请你分别为这几所高校，合并、分析所有的负面评论/槽点，写出一个 60 字以内高水平、客观简明的吐槽一句话总结（千万不要编造内容，仅对提供的讨论事实进行中立归纳）。`;

    const prompt = `${baseInstruction}

输出规范：
1. 请必须返回一个合法的 JSON 对象，它的键(Key)是列表里的高校名称 (schoolName)，值(Value)是提炼的 60 字以内吐槽归纳。例如：
{
  "中国石油大学（北京）": "校区偏远大一强制晨跑自习，学校管理拟高中化，且宿舍热水限制时间段供应，食堂高峰期排队较长。",
  "北京大学": "老旧宿舍园区住宿设施稍显陈旧，高峰时段食堂就餐较为拥挤，且部分专业课程绩点给分竞争较为激烈。"
}
2. 约束字数在 60 个汉字以内，直切要害（如：宿舍条件差、强制早操、教务死板、周边偏僻等）。
3. 语气中立客观，不要带有前缀（例如"总结："、"根据评论："、"该校槽点为"等），不废话，直接给出高信息浓度的总结。
4. 如果评论为空或全部是无意义或正面水贴，直接写"评论数据空泛或未见实质性被曝槽点"。

以下是需要分析的高校评论数据列表：
${JSON.stringify(promptInput, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const responseText = response.text ? response.text.trim() : "{}";
    let results: Record<string, string> = {};
    try {
      results = JSON.parse(responseText);
    } catch (parseError) {
      console.warn("Gemini didn't return perfect JSON or it failed to parse. Attempting code-block strip...");
      const cleanJsonStr = responseText.replace(/```json|```/g, "").trim();
      results = JSON.parse(cleanJsonStr);
    }

    return { results };

  } catch (error: any) {
    console.error("AI batch summarization failed:", error);
    const errString = String(error.message || error);
    if (
      errString.includes("429") ||
      errString.toLowerCase().includes("quota") ||
      errString.toLowerCase().includes("limit") ||
      errString.toLowerCase().includes("resource_exhausted")
    ) {
      return {
        results: {},
        isQuotaExceeded: true,
        errorMsg: "免费版 Gemini API 每日调用频次已限额 (Rate Limit Exceeded)。我们已为您自动无缝降级启动「底线直录槽点」本地模式，表格数据依然可以极速分析并导出！"
      };
    }
    throw new Error(`AI 批量总结失败: ${error.message || error}`);
  }
}