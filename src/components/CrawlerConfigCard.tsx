import React from 'react';
import {
  FileSpreadsheet,
  Sliders,
  ChevronDown,
  Cpu,
  Sparkles,
  Settings,
  Layers,
  Hourglass,
} from 'lucide-react';
import { motion } from 'motion/react';
import { FileData, ProcessingMode } from '../types';

interface CrawlerConfigCardProps {
  fileData: FileData;
  jobsCount: number;
  selectedColIndex: number;
  changeSelectedColumn: (idx: number) => void;
  mode: ProcessingMode;
  setMode: (mode: ProcessingMode) => void;
  concurrency: number;
  setConcurrency: (num: number) => void;
  aiBatchSize: number;
  setAiBatchSize: (num: number) => void;
  aiBatchInterval: number;
  setAiBatchInterval: (num: number) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  onResetConfigs: () => void;
  isRunning: boolean;
  lowEffects: boolean;
  onResetFile: () => void;
}

export const CrawlerConfigCard: React.FC<CrawlerConfigCardProps> = ({
  fileData,
  jobsCount,
  selectedColIndex,
  changeSelectedColumn,
  mode,
  setMode,
  concurrency,
  setConcurrency,
  aiBatchSize,
  setAiBatchSize,
  aiBatchInterval,
  setAiBatchInterval,
  customPrompt,
  setCustomPrompt,
  onResetConfigs,
  isRunning,
  lowEffects,
  onResetFile,
}) => {
  return (
    <motion.div
      id="crawler-config-parameters-card"
      layoutId={lowEffects ? undefined : "upload-card"}
      initial={lowEffects ? {} : { opacity: 0, scale: 0.98 }}
      animate={lowEffects ? {} : { opacity: 1, scale: 1 }}
      transition={lowEffects ? { duration: 0 } : undefined}
      className={`${
        lowEffects ? 'bg-slate-900/90' : 'bg-slate-900/40 backdrop-blur-2xl'
      } border border-white/10 p-6 shadow-2xl flex flex-col gap-6 text-slate-200 z-10`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              {fileData.fileName}
              <span className="text-xs font-normal text-slate-400 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                {(fileData.fileSize / 1024).toFixed(1)} KB
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              成功读取 {fileData.rows.length - 1} 行记录（已自动去重保留 {jobsCount} 个唯一高校名称）。
            </p>
          </div>
        </div>

        <div className="flex gap-2.5">
          {/* Reset configuration */}
          <button
            id="reset-config-btn"
            type="button"
            onClick={onResetConfigs}
            className="px-4 py-2 border border-white/10 text-xs font-medium rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            重置系统配置
          </button>

          {/* Change file target */}
          <button
            id="change-file-btn"
            onClick={onResetFile}
            className="px-4 py-2 border border-white/10 text-xs font-medium rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            重选文件
          </button>
        </div>
      </div>

      {/* Column custom matchers & config controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. Column Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-slate-400" />
            高校名称列 (自动规则匹配/手动)
          </label>
          <p className="text-[11px] text-slate-400">高校所在的名册列，将用作检索词</p>
          
          <div className="relative">
            <select
              id="column-selector-dropdown"
              value={selectedColIndex}
              onChange={(e) => changeSelectedColumn(Number(e.target.value))}
              className="w-full text-sm bg-slate-950/60 border border-white/10 text-slate-200 rounded-xl px-3.5 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer appearance-none"
            >
              {fileData.headers.map((h, idx) => (
                <option key={idx} value={idx}>
                  列 {idx + 1}: {h || `(空表头-${idx})`} {idx === fileData.detectedColIndex ? '【推荐】' : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* 2. Process mode choice */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 p-0">
            <Sparkles className="h-4 w-4 text-blue-400" />
            舆情处理分析模式
          </label>
          <p className="text-[11px] text-slate-400">选择舆情内容如何填入流向导出的备注列里</p>

          <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-xl border border-white/5">
            <button
              id="set-mode-local-btn"
              type="button"
              onClick={() => setMode('local')}
              className={`text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${mode === 'local' ? 'bg-white/10 text-white shadow-xs border border-white/10' : 'text-slate-400 hover:text-white'}`}
            >
              <Cpu className="h-3.5 w-3.5" />
              完全本地模式
            </button>
            <button
              id="set-mode-ai-btn"
              type="button"
              onClick={() => setMode('ai')}
              className={`text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${mode === 'ai' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-blue-400'}`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 智能总结模式
            </button>
          </div>
        </div>

        {/* 3. Concurrency Thread count */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between gap-1.5">
            <span className="flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-slate-400" />
              并发线程数 (采集速度)
            </span>
            <span className="text-xs text-blue-400 font-mono font-semibold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
              {concurrency} 线程同时爬取
            </span>
          </label>
          <p className="text-[11px] text-slate-400">设置后台多进程多线程并行加载的速率限制</p>

          <div className="flex items-center gap-3 pt-2">
            <input
              id="concurrency-range-slider"
              type="range"
              min="1"
              max="10"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={isRunning}
              className="flex-1 accent-blue-500 cursor-pointer disabled:opacity-40"
            />
            <span className="text-xs text-slate-400 font-mono w-4 text-right">{concurrency}</span>
          </div>
        </div>

      </div>

      {/* AI Batch advanced speed/error-cooldown controllers */}
      {mode === 'ai' && (
        <div className="pt-5 border-t border-white/5 flex flex-col gap-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className={`h-3.5 w-3.5 text-blue-400 ${lowEffects ? '' : 'animate-pulse'}`} />
            AI 批量总结组包与间隔控制 (防 API 频限)
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Batch Size Slider */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-slate-400" />
                  每组合并分析高校数 (Batch Size)
                </span>
                <span className="text-xs text-blue-400 font-mono font-semibold bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-md">
                  {aiBatchSize} 所高校/组
                </span>
              </label>
              <p className="text-[11px] text-slate-400">单次批量请求中打包的高校数。数额越大越能极大地节省大模型调用额度消耗与轮询等待，数额越小越能保障各高校槽点提炼准确度。</p>

              <div className="flex items-center gap-3 pt-2">
                <input
                  id="ai-batch-size-slider"
                  type="range"
                  min="2"
                  max="40"
                  step="1"
                  value={aiBatchSize}
                  onChange={(e) => setAiBatchSize(Number(e.target.value))}
                  disabled={isRunning}
                  className="flex-1 accent-blue-500 cursor-pointer disabled:opacity-40"
                />
                <span className="text-xs text-slate-400 font-mono w-6 text-right">{aiBatchSize}</span>
              </div>
            </div>

            {/* Delay Interval (Cooldown) Slider */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Hourglass className="h-4 w-4 text-slate-400" />
                  组请求安全等待延迟 (Wait Interval)
                </span>
                <span className="text-xs text-blue-400 font-mono font-semibold bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-md">
                  {aiBatchInterval} 秒
                </span>
              </label>
              <p className="text-[11px] text-slate-400">发送完上一组批量 AI 总结请求后强制进入的安全等待间隔（防429频限）。推荐至少设置 1.5 - 3.0 秒秒数延迟。</p>

              <div className="flex items-center gap-3 pt-2">
                <input
                  id="ai-batch-interval-slider"
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={aiBatchInterval}
                  onChange={(e) => setAiBatchInterval(Number(e.target.value))}
                  disabled={isRunning}
                  className="flex-1 accent-blue-500 cursor-pointer disabled:opacity-40"
                />
                <span className="text-xs text-slate-400 font-mono w-6 text-right">{aiBatchInterval}s</span>
              </div>
            </div>
          </div>

          {/* Custom Prompt Textarea */}
          <div className="flex flex-col gap-2 mt-2 border-t border-white/5 pt-4">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-400" />
                自定义 AI 总结指令 / 提示词 (Custom Summary Prompt)
              </span>
              <button
                id="reset-prompt-preset-btn"
                type="button"
                onClick={() => setCustomPrompt('你是一个中国高校舆情和网友曝光评论的深度总结专家。请分别为下面的几所高校，根据提供的吐槽和爆料评论，写出一个 60 字以内高水平、客观简明的吐槽一句话总结（千万不要编造内容，仅对提供的讨论事实进行中立归纳）。语气中立客观，不要带有前缀（例如“总结：”、“根据评论：”等），不废话，直接给出高信息浓度的总结。')}
                className="text-[10px] text-blue-400 hover:text-blue-350 font-medium hover:underline transition-colors"
              >
                恢复默认字数与指令
              </button>
            </label>
            <p className="text-[11px] text-slate-400">
              您可以编写让大模型从特定维度总结的分析视角，系统自动维护底层 JSON 标准格式输出。
            </p>
            <textarea
              id="custom-prompt-textarea"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isRunning}
              rows={4}
              maxLength={600}
              placeholder="请输入自定义的大模型总结提示词指令..."
              className="w-full text-xs font-sans bg-slate-950/60 border border-white/10 text-slate-200 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-y min-h-[100px] leading-relaxed"
            />
            <div className="text-[10px] text-slate-500 text-right">
              {customPrompt.length}/600 字 (默认提示词已更新约束大模型生成不超过 60 字的高含金量总结)
            </div>
          </div>
        </div>
      )}

      {/* Advanced warning description */}
      {mode === 'ai' && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <strong>AI 模式精讲：</strong>采集神人高校网上对应的高校负面舆情评论后，服务器会自动调用 <strong>Gemini 3.5 Flash</strong> 大语言模型智能分析各暴露槽点，并全自动压缩为您一键可见的「极简备注评价（60字以内）」。此过程需要保持网络稳定。
          </div>
        </div>
      )}
    </motion.div>
  );
};
