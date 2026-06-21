# Vercel 部署指南

## 部署前准备

### 1. 环境变量配置
在 Vercel 项目设置中配置以下环境变量：

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `GEMINI_API_KEY` | Google Gemini API 密钥 | 访问 [Google AI Studio](https://aistudio.google.com/apikey) 获取 |

### 2. 代码调整
已完成的调整：
- ✅ 创建 `api/` 目录包含两个 Serverless Functions
- ✅ 提取共享逻辑到 `lib/` 目录
- ✅ 更新 `package.json` 依赖
- ✅ 创建 `vercel.json` 配置文件
- ✅ 更新前端 API 调用路径

## 部署步骤

### 方法一：通过 GitHub 部署（推荐）
1. 将代码推送到 GitHub 仓库
2. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
3. 点击 "New Project"
4. 导入你的 GitHub 仓库
5. Vercel 会自动检测配置并部署
6. 在项目设置中配置环境变量

### 方法二：通过 Vercel CLI 部署
1. 安装 Vercel CLI：
   ```bash
   npm i -g vercel
   ```
2. 登录 Vercel：
   ```bash
   vercel login
   ```
3. 部署项目：
   ```bash
   vercel
   ```
4. 生产环境部署：
   ```bash
   vercel --prod
   ```

## 验证部署

### 1. 测试 API 端点
部署后，访问以下端点验证功能：

1. **抓取学校数据**：
   ```
   GET https://your-app.vercel.app/api/scrape-school?name=北京大学
   ```

2. **批量分析**：
   ```bash
   curl -X POST https://your-app.vercel.app/api/ai-summarize-batch \
     -H "Content-Type: application/json" \
     -d '{
       "schools": [
         {
           "name": "北京大学",
           "comments": ["食堂排队太长", "宿舍条件一般"]
         }
       ]
     }'
   ```

### 2. 检查前端功能
1. 访问应用首页
2. 测试学校搜索功能
3. 测试批量分析功能
4. 验证数据导出功能

## 故障排除

### 常见问题

#### 1. API 返回 404
- 检查 `vercel.json` 配置是否正确
- 确认 `api/` 目录下的文件存在
- 检查路由配置

#### 2. AI 总结失败
- 检查 `GEMINI_API_KEY` 环境变量是否正确设置
- 验证 API 密钥是否有足够的配额
- 查看 Vercel 日志中的错误信息

#### 3. CORS 错误
- 前端和后端域名不一致时可能出现
- API 函数已设置 CORS 头，通常不需要额外配置

#### 4. 构建失败
- 检查 `package.json` 依赖是否正确
- 确认 TypeScript 配置
- 查看构建日志中的具体错误

### 查看日志
1. 在 Vercel Dashboard 中选择项目
2. 点击 "Deployments"
3. 选择最新的部署
4. 点击 "View Logs" 查看详细日志

## 更新部署

### 代码更新后
1. 推送代码到 GitHub
2. Vercel 会自动触发重新部署
3. 或手动在 Vercel Dashboard 中触发部署

### 环境变量更新
1. 在 Vercel 项目设置中更新环境变量
2. 重新部署项目使新环境变量生效

## 性能优化建议

### 1. 冷启动优化
- 使用 `@vercel/node` 运行时
- 保持函数代码简洁
- 避免大型依赖

### 2. 内存使用
- 默认内存：1024MB
- 如需更高内存，可在 `vercel.json` 中配置

### 3. 超时设置
- 默认超时：10秒
- 如需更长超时，可在 `vercel.json` 中配置

## 安全注意事项

### 1. API 密钥保护
- 永远不要将 API 密钥提交到代码仓库
- 使用 Vercel 环境变量存储敏感信息
- 定期轮换 API 密钥

### 2. 访问控制
- 考虑添加 API 密钥验证
- 限制请求频率
- 监控异常访问

## 支持与帮助

- Vercel 文档：https://vercel.com/docs
- GitHub Issues：报告代码问题
- Vercel Support：部署相关问题