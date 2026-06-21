import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scrapeSchool } from '../lib/scraper';
import { setCorsHeaders, handleOptionsRequest, createErrorResponse } from '../lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (handleOptionsRequest(req, res)) {
    return;
  }

  // Set CORS headers
  setCorsHeaders(res);

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '只支持 GET 请求' });
  }

  const schoolName = req.query.name as string;
  
  if (!schoolName) {
    return res.status(400).json({ error: "学校名称不能为空" });
  }

  try {
    const result = await scrapeSchool(schoolName);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error(`Error crawling university ${schoolName}:`, error);
    return res.status(500).json({
      error: `爬取失败: ${error.message || error}`,
      schoolName,
      matched: false,
      comments: [],
      hasNegative: false,
    });
  }
}

// Optional: Configure runtime (Node.js runtime is default)
export const config = {
  runtime: 'nodejs',
};