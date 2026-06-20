import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import dns from "dns";

// Fix Node.js fetch local lookup issues if any
dns.setDefaultResultOrder("ipv4first");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini client on the server
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY process env is not configured. Please set it in AI Studio Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Helper to clean university name annotations and yield fallback search phrases
function getSearchKeywords(schoolName: string): string[] {
  let base = schoolName.trim().split(/\r?\n/)[0].trim();
  base = base.replace(/\s+/g, "");
  
  // Normalize full-width parentheticals to standard half-width
  base = base.replace(/（/g, "(").replace(/）/g, ")");
  base = base.replace(/【/g, "[").replace(/】/g, "]");

  const keywords: string[] = [];

  // 1. Clean noise terms like (本科), (公办), (民办) but keep campus names like (华东) or (深圳校区)
  const noiseRegex = /\((本科|专科|公办|民办|独立学院|中外合资|中外合作|筹|建设中|高职|高专|成人|网络|双一流|211|985|省属|市属|部属|公立|私立|普通|职业|技术|公立普通高校)\)/gi;
  const bracketNoise = /\[(本科|专科|公办|民办|独立学院|中外合资|中外合作|筹|建设中|高职|高专|成人|网络|双一流|211|985|省属|市属|部属|公立|私立|普通|职业|技术|公立普通高校)\]/gi;
  
  let kw1 = base.replace(noiseRegex, "").replace(bracketNoise, "").trim();
  if (kw1) {
    keywords.push(kw1);
  }

  // 2. Clear ALL bracket expressions completely (e.g. "中国石油大学(华东)" -> "中国石油大学")
  let kw2 = base.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim();
  if (kw2 && kw2 !== kw1) {
    keywords.push(kw2);
  }

  // 3. Keep purely alphanumerics + chinese
  let kw3 = kw2.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").trim();
  if (kw3 && kw3 !== kw2 && kw3 !== kw1) {
    keywords.push(kw3);
  }

  // 4. Match the first contiguous chunk ending with "大学" or "学院" or "学校"
  const match = base.match(/^([\u4e00-\u9fa5]+(大学|学院|学校|分校))/);
  if (match && match[1]) {
    const kw4 = match[1];
    if (!keywords.includes(kw4)) {
      keywords.push(kw4);
    }
  }

  if (keywords.length === 0) {
    keywords.push(base);
  }

  // Deduplicate and filter extremely short terms
  return Array.from(new Set(keywords)).filter(k => k.length >= 2);
}

// Helper to determine string similarity for matching school names
function calculateMatches(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  
  // Normalize characters and casing
  const n1 = s1.toLowerCase()
    .replace(/（/g, "(").replace(/）/g, ")")
    .replace(/【/g, "[").replace(/】/g, "]")
    .replace(/\s+/g, "");
    
  const n2 = s2.toLowerCase()
    .replace(/（/g, "(").replace(/）/g, ")")
    .replace(/【/g, "[").replace(/】/g, "]")
    .replace(/\s+/g, "");

  if (n1 === n2) return 1.0;

  // Substring inclusion bonus
  if (n1.includes(n2) || n2.includes(n1)) {
    const shorter = Math.min(n1.length, n2.length);
    const longer = Math.max(n1.length, n2.length);
    return 0.85 + (shorter / longer) * 0.15;
  }

  let matches = 0;
  for (let i = 0; i < n1.length; i++) {
    if (n2.includes(n1[i])) {
      matches++;
    }
  }
  return matches / Math.max(n1.length, n2.length);
}

// Scrape Route
app.get("/api/scrape-school", async (req, res) => {
  const schoolName = req.query.name as string;
  if (!schoolName) {
    return res.status(400).json({ error: "学校名称不能为空" });
  }

  const cleanName = schoolName.trim();
  console.log(`Starting crawl for school: ${cleanName}`);

  try {
    const searchKeywords = getSearchKeywords(cleanName);
    console.log(`Generated clean search keywords for "${cleanName}":`, searchKeywords);

    const candidates: { id: number; name: string; slug: string; score: number }[] = [];
    const triedKeywords: string[] = [];

    // Loop through keywords to find matches via official search API
    for (const keyword of searchKeywords) {
      if (candidates.length > 0) break; // Matches found, avoid unnecessary loads

      triedKeywords.push(keyword);
      console.log(`Querying srgaoxiao search API with query: "${keyword}"`);

      const searchUrl = `https://srgaoxiao.com/api/schools?keyword=${encodeURIComponent(keyword)}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      });

      if (!searchResponse.ok) {
        console.warn(`Search API request failed for "${keyword}", status: ${searchResponse.status}`);
        continue;
      }

      const json: any = await searchResponse.json();
      const schoolList = json.data || [];

      for (const item of schoolList) {
        if (!item.name || !item.id) continue;
        
        // Match similarity against the first cleaned keyword (removes noise annotations like (本科), (公办))
        const cleanQuery = searchKeywords[0];
        const score = Math.max(
          calculateMatches(cleanQuery, item.name),
          calculateMatches(cleanName, item.name)
        );

        if (!candidates.some(c => c.id === item.id)) {
          candidates.push({
            id: item.id,
            name: item.name,
            slug: item.slug || item.name,
            score,
          });
        }
      }
    }

    // Sort matching results descending
    candidates.sort((a, b) => b.score - a.score);

    // Get the maximum similarity (must match at least 25% to avoid unrelated false positives)
    const bestMatch = candidates.find(c => c.score >= 0.25);

    if (!bestMatch) {
      console.log(`School not found on srgaoxiao: ${cleanName}`);
      return res.json({
        schoolName: cleanName,
        matched: false,
        matchedSchoolName: null,
        matchedUrl: null,
        comments: [],
        hasNegative: false,
      });
    }

    const absoluteDetailUrl = `https://srgaoxiao.com/school/${encodeURIComponent(bestMatch.slug)}`;
    console.log(`Matched university "${cleanName}" -> "${bestMatch.name}" (ID: ${bestMatch.id}) at URL: ${absoluteDetailUrl}`);

    // Fetch the school's reviews from the official API
    const reviewsUrl = `https://srgaoxiao.com/api/reviews/school/${bestMatch.id}?sort=comprehensive&page=1&pageSize=40`;
    console.log(`Querying reviews API at: ${reviewsUrl}`);
    
    const reviewsResponse = await fetch(reviewsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!reviewsResponse.ok) {
      throw new Error(`无法获取学校评价列表，状态码: ${reviewsResponse.status}`);
    }

    const reviewsJson: any = await reviewsResponse.json();
    const reviewsList = reviewsJson.data || [];
    const comments: string[] = [];

    for (const r of reviewsList) {
      if (r.content && typeof r.content === "string") {
        const text = r.content.replace(/\s+/g, " ").trim();
        if (text.length > 8 && !comments.includes(text)) {
          comments.push(text);
        }
      }
    }

    // Clean comments list (remove header/footer copyright text, empty strings, buttons keywords)
    const cleanComments = comments
      .filter(c => {
        if (!c || typeof c !== "string") return false;
        const lower = c.toLowerCase();
        if (
          lower === "回复" || 
          lower === "分享" || 
          lower === "举报" || 
          lower.includes("点击登录") ||
          lower.includes("我的关注") ||
          lower.includes("关于我们") ||
          lower.includes("版权所有") ||
          lower.includes("友情链接")
        ) {
          return false;
        }
        return true;
      })
      .slice(0, 30); // Limit to top 30 to prevent payload bloat

    console.log(`Crawl completed for ${cleanName}. Found ${cleanComments.length} comments.`);

    return res.json({
      schoolName: cleanName,
      matched: true,
      matchedSchoolName: bestMatch.name,
      matchedUrl: absoluteDetailUrl,
      comments: cleanComments,
      hasNegative: cleanComments.length > 0,
    });

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
});

// Gemini Summarize Route (Legacy/Single fallback)
app.post("/api/ai-summarize", async (req, res) => {
  const { schoolName, comments } = req.body;

  if (!schoolName) {
    return res.status(400).json({ error: "学校名称不能为空" });
  }

  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    return res.json({ summary: "未发现相关吐槽或曝光记录" });
  }

  try {
    const ai = getAiClient();
    const prompt = `你是一个高校舆情和吐槽曝光评论的分析专家。
下面是关于【${schoolName}】这所大学被网友吐槽和评论的内容：
---
${comments.map((c, idx) => `[评论 ${idx + 1}]: ${c}`).join("\n\n")}
---

请合并和分析这些吐槽，写出一个极其简明扼要的槽点总结。
约束条件：
1. 字数在 20 字以内。
2. 语气客观中立，避开主观评价（字数决不能超出 20 个字）。
3. 如果评论都是水贴或无意义内容，直接概括写“未见实质吐槽”。`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const summary = response.text ? response.text.trim() : "无负面舆情总结";
    return res.json({ summary });
  } catch (error: any) {
    console.error(`AI Summarization failed for ${schoolName}:`, error);
    const errString = String(error.message || error);
    if (
      errString.includes("429") ||
      errString.toLowerCase().includes("quota") ||
      errString.toLowerCase().includes("limit") ||
      errString.toLowerCase().includes("resource_exhausted")
    ) {
      return res.json({
        summary: "免费API额度已满，启动降级备注",
        isQuotaExceeded: true
      });
    }
    return res.status(500).json({ error: `AI 总结失败: ${error.message || error}` });
  }
});

// Gemini Batch Summarize Route
app.post("/api/ai-summarize-batch", async (req, res) => {
  const { schools } = req.body;

  if (!schools || !Array.isArray(schools) || schools.length === 0) {
    return res.status(400).json({ error: "学校列表不能为空" });
  }

  try {
    const ai = getAiClient();
    
    // Structure input data for Gemini to see
    const promptInput = schools.map(s => ({
      schoolName: s.name,
      comments: (s.comments || []).slice(0, 15)
    }));

    const prompt = `你是一个中国高校舆情和网友曝光评论的深度总结专家。
现在，有 ${schools.length} 所高校的吐槽和爆料评论列表。请你分别为这几所高校，合并、分析所有的负面评论/槽点，写出一个 20 字以内高水平、客观简明的吐槽一句话总结（千万不要编造内容，仅对提供的讨论事实进行中立归纳）。

输出规范：
1. 请必须返回一个合法的 JSON 对象，它的键(Key)是列表里的高校名称 (schoolName)，值(Value)是提炼的 20 字以内吐槽归纳。例如：
{
  "中国石油大学（北京）": "校区偏远大一强制晨跑自习，管理拟高中化",
  "北京大学": "食堂拥挤，部分楼宿年代比较久远"
}
2. 约束字数在 20 个汉字以内，直切要害（如：宿舍条件差、强制早操、教务死板、周边偏僻等）。
3. 语气中立客观，不要带有前缀（例如“总结：”、“根据评论：”、“该校槽点为”等），不废话，直接给出高信息浓度的总结。
4. 如果评论为空或全部是无意义或正面水贴，直接写“评论数据空泛或未见实质性被曝槽点”。

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

    return res.json({ results });

  } catch (error: any) {
    console.error("AI batch summarization failed:", error);
    const errString = String(error.message || error);
    if (
      errString.includes("429") ||
      errString.toLowerCase().includes("quota") ||
      errString.toLowerCase().includes("limit") ||
      errString.toLowerCase().includes("resource_exhausted")
    ) {
      return res.json({
        results: {},
        isQuotaExceeded: true,
        errorMsg: "免费版 Gemini API 每日调用频次已限额 (Rate Limit Exceeded)。我们已为您自动无缝降级启动「底线直录槽点」本地模式，表格数据依然可以极速分析并导出！"
      });
    }
    return res.status(500).json({ error: `AI 批量总结失败: ${error.message || error}` });
  }
});

// Start routing with static assets or Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode with compiled client...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
