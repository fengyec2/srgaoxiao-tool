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

// Helper to determine string similarity for matching school names
function calculateMatches(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    if (s2.includes(s1[i])) {
      matches++;
    }
  }
  return matches / Math.max(s1.length, s2.length);
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
    // 1. Search school on srgaoxiao
    const searchUrl = `https://srgaoxiao.com/schools?keyword=${encodeURIComponent(cleanName)}&page=1`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`无法访问神人高校网，状态码: ${searchResponse.status}`);
    }

    const searchHtml = await searchResponse.text();
    const $search = cheerio.load(searchHtml);

    // Collect school anchors
    const candidates: { name: string; href: string; score: number }[] = [];
    $search("a").each((_, el) => {
      const href = $search(el).attr("href") || "";
      const text = $search(el).text().trim();
      
      // Look for school details href pattern: e.g. /schools/1 or /school/xxx
      if ((href.includes("/schools/") || href.includes("/school/")) && text.length > 1) {
        // Exclude generic /schools index pages or page navigation links
        if (href === "/schools" || href.endsWith("/schools/")) return;
        
        const score = calculateMatches(cleanName, text);
        candidates.push({
          name: text,
          href,
          score,
        });
      }
    });

    // Also look for grid headings of school names in the HTML just in case
    $search(".school-card, .school-item, .card, h2, h3").each((_, el) => {
      const cardText = $search(el).text().trim();
      const cardLink = $search(el).find("a").attr("href") || $search(el).closest("a").attr("href") || "";
      if (cardLink && (cardLink.includes("/schools/") || cardLink.includes("/school/")) && cardText.length > 1) {
        if (cardLink === "/schools" || cardLink.endsWith("/schools/")) return;
        const shortText = cardText.split("\n")[0].trim();
        const score = calculateMatches(cleanName, shortText);
        // Avoid duplicates
        if (!candidates.some(c => c.href === cardLink)) {
          candidates.push({ name: shortText, href: cardLink, score });
        }
      }
    });

    // Sort by name similarity score descending
    candidates.sort((a, b) => b.score - a.score);

    // Select the best candidate (must match at least 25% of characters to prevent false positives)
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

    const matchedHref = bestMatch.href;
    const absoluteDetailUrl = matchedHref.startsWith("http")
      ? matchedHref
      : `https://srgaoxiao.com${matchedHref}`;

    console.log(`Matched university "${cleanName}" -> "${bestMatch.name}" at url: ${absoluteDetailUrl}`);

    // 2. Fetch the school details page to get comments/posts/incidents
    const detailResponse = await fetch(absoluteDetailUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    if (!detailResponse.ok) {
      throw new Error(`无法获取学校详情页，状态码: ${detailResponse.status}`);
    }

    const detailHtml = await detailResponse.text();
    const $detail = cheerio.load(detailHtml);

    const comments: string[] = [];

    // Extract commentary texts or posts
    // Look and extract text inside elements with classes depicting posts, content or items
    const selectors = [
      ".post-content", 
      ".comment-content", 
      ".review-content", 
      ".incident-content",
      "article .content",
      ".school-review",
      ".comment-item",
      ".post-item .content",
      ".card-content",
      ".review-body",
      ".school-comment p",
      "p.content",
      ".item-content",
      "p.text-gray-700",
      "div.text-sm.text-gray-600",
      "div.content"
    ];

    selectors.forEach(sel => {
      $detail(sel).each((_, el) => {
        const text = $detail(el).text().trim();
        // Remove noise, short words, or boilerplate buttons
        if (text.length > 8 && !comments.includes(text)) {
          // Additional cleanup of common noise
          const cleanText = text
            .replace(/\s+/g, " ")
            .trim();
          if (cleanText.length > 8) {
            comments.push(cleanText);
          }
        }
      });
    });

    // If we gathered no structural comments, let's grab general paragraphs representing issues
    if (comments.length === 0) {
      $detail("article p, .card p, .main p").each((_, el) => {
        const text = $detail(el).text().trim();
        if (text.length > 15 && text.length < 800) {
          const cleanText = text.replace(/\s+/g, " ").trim();
          if (!comments.includes(cleanText) && !cleanText.includes("版权所有") && !cleanText.includes("京ICP")) {
            comments.push(cleanText);
          }
        }
      });
    }

    // Clean comments list (remove headers/footers terms, buttons tags like 回复 赞 踩 etc.)
    const cleanComments = comments
      .filter(c => {
        const lower = c.toLowerCase();
        // Skip obvious button configurations or footer copyright
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

// Gemini Summarize Route
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
下面是关于【${schoolName}】这所大学在神人高校网被网友吐槽和评论的内容：
---
${comments.map((c, idx) => `[评论 ${idx + 1}]: ${c}`).join("\n\n")}
---

请合并和分析这些吐槽，写出一个极其简明扼要的槽点总结。
约束条件：
1. 字数在20字以内。
2. 切中要害（如：宿舍无空调、食堂偏贵、强制晨跑、管理僵硬等）。
3. 语气客观简练，不要有任何前缀或解释，直接给出这句总结。
4. 如果评论全无实质性爆料或都在灌水，则简述为“有舆情记录但爆料内容空泛”。
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const summary = response.text ? response.text.trim() : "无核心槽点";
    
    // Remove wrapping quotes if any
    const cleanSummary = summary.replace(/^["'“]+|["'”]+$/g, "");

    return res.json({ summary: cleanSummary });

  } catch (error: any) {
    console.error(`AI summarization failed for ${schoolName}:`, error);
    return res.status(500).json({ error: `AI 总结失败: ${error.message || error}` });
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
