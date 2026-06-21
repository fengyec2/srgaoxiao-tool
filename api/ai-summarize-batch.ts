import type { VercelRequest, VercelResponse } from '@vercel/node';
import { summarizeBatch } from '../lib/ai-client';
import { setCorsHeaders, handleOptionsRequest } from '../lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (handleOptionsRequest(req, res)) {
    return;
  }

  // Set CORS headers
  setCorsHeaders(res);

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { schools, customPrompt } = req.body;

  if (!schools || !Array.isArray(schools) || schools.length === 0) {
    return res.status(400).json({ error: "学校列表不能为空" });
  }

  try {
    const result = await summarizeBatch(schools, customPrompt);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("AI batch summarization failed:", error);
    const errString = String(error.message || error);
    
    if (
      errString.includes("429") ||
      errString.toLowerCase().includes("quota") ||
      errString.toLowerCase().includes("limit") ||
      errString.toLowerCase().includes("resource_exhausted")
    ) {
      return res.status(200).json({
        results: {},
        isQuotaExceeded: true,
        errorMsg: "免费版 Gemini API 每日调用频次已限额 (Rate Limit Exceeded)。我们已为您自动无缝降级启动「底线直录槽点」本地模式，表格数据依然可以极速分析并导出！"
      });
    }
    
    return res.status(500).json({ error: `AI 批量总结失败: ${error.message || error}` });
  }
}

// Optional: Configure runtime (Node.js runtime is default)
export const config = {
  runtime: 'nodejs',
};