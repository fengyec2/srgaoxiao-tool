<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# 高校吐槽抓取与分析工具

这是一个全栈 TypeScript 项目，用于抓取高校评价数据并使用 AI 进行分析总结。

## 本地开发

**环境要求:** Node.js 18+

1. 安装依赖：
   ```bash
   npm install
   ```
2. 复制环境变量文件：
   ```bash
   cp .env.example .env.local
   ```
3. 在 `.env.local` 中设置你的 `GEMINI_API_KEY`
4. 启动开发服务器：
   ```bash
   npm run dev
   ```

## 部署到 Vercel

### 环境变量配置
在 Vercel 项目设置中配置以下环境变量：
- `GEMINI_API_KEY`: 你的 Google Gemini API 密钥

### 部署步骤
1. 将代码推送到 GitHub 仓库
2. 在 Vercel 中导入该仓库
3. Vercel 会自动检测项目配置并部署
4. 在 Vercel 项目设置中配置环境变量

### API 端点
部署后，以下 API 端点将可用：
- `GET /api/scrape-school?name=学校名称` - 抓取学校评价数据
- `POST /api/ai-summarize-batch` - 批量分析学校评论

### 项目结构
```
srgaoxiao-tool/
├── api/                    # Vercel Serverless Functions
│   ├── scrape-school.ts    # 抓取学校数据
│   └── ai-summarize-batch.ts # 批量分析
├── lib/                    # 共享逻辑
│   ├── scraper.ts          # 爬虫逻辑
│   ├── ai-client.ts        # AI 调用封装
│   └── utils.ts            # 工具函数
├── src/                    # 前端 React 代码
├── dist/                   # 构建后的前端资源
├── package.json
├── tsconfig.json
├── vercel.json            # Vercel 配置
└── README.md
```
