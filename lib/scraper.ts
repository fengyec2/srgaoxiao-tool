import * as cheerio from "cheerio";

// Helper to clean university name annotations and yield fallback search phrases
export function getSearchKeywords(schoolName: string): string[] {
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
export function calculateMatches(s1: string, s2: string): number {
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

// Main scraping function
export async function scrapeSchool(schoolName: string) {
  const cleanName = schoolName.trim();
  console.log(`Starting crawl for school: ${cleanName}`);

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
    return {
      schoolName: cleanName,
      matched: false,
      matchedSchoolName: null,
      matchedUrl: null,
      comments: [],
      hasNegative: false,
    };
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

  return {
    schoolName: cleanName,
    matched: true,
    matchedSchoolName: bestMatch.name,
    matchedUrl: absoluteDetailUrl,
    comments: cleanComments,
    hasNegative: cleanComments.length > 0,
  };
}