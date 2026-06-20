import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Hourglass,
  Loader2,
  Sparkles,
  CheckCircle2,
  Info,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Cpu
} from 'lucide-react';
import { SchoolJob, ProcessingMode } from '../types';

interface JobListTableProps {
  jobs: SchoolJob[];
  expandedJobIds: Set<string>;
  toggleRowDetail: (id: string) => void;
  mode: ProcessingMode;
  lowEffects: boolean;
}

export const JobListTable: React.FC<JobListTableProps> = ({
  jobs,
  expandedJobIds,
  toggleRowDetail,
  mode,
  lowEffects,
}) => {
  return (
    <div
      id="jobs-list-container-card"
      className={`${
        lowEffects ? 'bg-slate-900 shadow-md' : 'bg-slate-900/40 backdrop-blur-md shadow-2xl'
      } border border-white/10 rounded-3xl overflow-hidden flex-1 flex flex-col text-slate-200`}
    >
      <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-100">检索分析列表</h4>
        </div>
        <div className="text-[11px] text-slate-400">
          点击各个高校行，可下拉展开具体抓取到的原贴争议吐槽爆料！
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
          <Hourglass className={`h-12 w-12 text-slate-600 mb-2 ${lowEffects ? '' : 'animate-pulse'}`} />
          <p className="text-sm">暂无待检索的高校数据行</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-xs font-semibold text-slate-300">
                <th className="px-5 py-3 w-16">序号</th>
                <th className="px-5 py-3">高校名称（原表格）</th>
                <th className="px-5 py-3 w-40">检索状态</th>
                <th className="px-5 py-3">匹配结果 （神人高校网目标）</th>
                <th className="px-5 py-3">备注结果列预览 (将回写进导出表格)</th>
                <th className="px-5 py-3 w-12 text-center">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jobs.map((job, idx) => {
                const isExpanded = expandedJobIds.has(job.id);
                return (
                  <React.Fragment key={job.id}>
                    <tr
                      id={`job-row-${idx}`}
                      onClick={() => toggleRowDetail(job.id)}
                      className={`group cursor-pointer hover:bg-white/5 transition-colors ${isExpanded ? 'bg-white/5' : ''}`}
                    >
                      {/* Index num */}
                      <td className="px-5 py-4 text-xs font-mono text-slate-400 font-medium">#{idx + 1}</td>
                      
                      {/* School Name */}
                      <td className="px-5 py-4 font-semibold text-slate-200">{job.name}</td>
                      
                      {/* Status badges */}
                      <td className="px-5 py-4 text-xs">
                        {job.status === 'waiting' && (
                          <span className="px-2 py-1 rounded bg-white/5 text-slate-300 border border-white/10 flex items-center gap-1 w-max">
                            <Hourglass className="h-3 w-3" />
                            排队就绪
                          </span>
                        )}
                        {job.status === 'scraping' && (
                          <span className={`px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 w-max font-medium ${lowEffects ? '' : 'animate-pulse'}`}>
                            <Loader2 className={`h-3 w-3 ${lowEffects ? '' : 'animate-spin'}`} />
                            正在抓取舆情
                          </span>
                        )}
                        {job.status === 'analyzing' && (
                          <span className={`px-2 py-1 rounded border flex items-center gap-1 w-max font-medium ${lowEffects ? '' : 'animate-pulse'} ${job.error ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                            <Sparkles className={`h-3 w-3 ${lowEffects ? '' : 'animate-spin'} ${job.error ? 'text-amber-400' : 'text-purple-400'}`} />
                            {job.error ? 'AI 总结中...' : 'AI 提炼槽点...'}
                          </span>
                        )}
                        {job.status === 'scraped' && (
                          <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1 w-max font-medium">
                            <CheckCircle2 className="h-3 w-3 text-indigo-400" />
                            已抓取(待 AI)
                          </span>
                        )}
                        {job.status === 'completed' && (
                          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-max font-medium">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            检索完成
                          </span>
                        )}
                        {job.status === 'not_found' && (
                          <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1 w-max">
                            <Info className="h-3 w-3" />
                            未查到负面
                          </span>
                        )}
                        {job.status === 'failed' && (
                          <span className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-max font-medium">
                            <XCircle className="h-3 w-3" />
                            接口异常
                          </span>
                        )}
                      </td>

                      {/* Matched name on site */}
                      <td className="px-5 py-4">
                        {job.matchedName ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-200 text-xs font-semibold">{job.matchedName}</span>
                            {job.matchedUrl && (
                              <a
                                href={job.matchedUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()} // Stop clicking row event
                                className="text-[10px] text-slate-400 hover:text-blue-400 flex items-center gap-0.5 inline-flex"
                              >
                                网页存档
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>

                      {/* Result Preview Remark Column */}
                      <td className="px-5 py-4 text-xs">
                        {job.remark ? (
                          <span className="text-slate-300 line-clamp-1 max-w-sm" title={job.remark}>
                            {job.remark}
                          </span>
                        ) : job.status === 'scraped' ? (
                          <span className="text-indigo-400 font-medium font-sans">已抓取 {job.comments.length} 条评论，待一并总结</span>
                        ) : job.status === 'analyzing' && job.error ? (
                          <span className={`text-amber-400 font-medium font-sans ${lowEffects ? '' : 'animate-pulse'}`}>{job.error}</span>
                        ) : job.status === 'failed' && job.error ? (
                          <span className="text-rose-400 line-clamp-1">{job.error}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Expand Arrow */}
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Collapsed comments panel dropdown */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className={`${lowEffects ? 'bg-slate-900 shadow-inner' : 'bg-slate-950/40'} p-0 border-b border-white/5`}>
                            <motion.div
                              initial={lowEffects ? {} : { opacity: 0, height: 0 }}
                              animate={lowEffects ? {} : { opacity: 1, height: 'auto' }}
                              exit={lowEffects ? {} : { opacity: 0, height: 0 }}
                              transition={lowEffects ? { duration: 0 } : undefined}
                              className="overflow-hidden"
                            >
                              <div className="px-8 py-5 flex flex-col gap-4">
                                
                                {/* Stats summary banner */}
                                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                    <h5 className="text-xs font-semibold text-slate-300">舆情槽点原帖曝光 ({job.comments.length} 条)</h5>
                                  </div>
                                  {job.matchedUrl && (
                                    <a
                                      href={job.matchedUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                      点此跳转去神人高校网查阅更多评论
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>

                                {/* Scraped lines list */}
                                {job.comments.length === 0 ? (
                                  <div className="py-4 text-center text-xs text-slate-500 italic">
                                    {!job.matchedName 
                                      ? '该高校在神人高校网暂无条目档案。' 
                                      : '该高校有条目档案，但评论区暂空无吐槽。'}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
                                    {job.comments.map((comment, cIdx) => (
                                      <div
                                        key={cIdx}
                                        className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 leading-relaxed shadow-sm flex gap-2.5 items-start hover:border-white/20 transition-all"
                                      >
                                        <span className="h-5 w-5 rounded-full bg-blue-500/20 font-semibold font-mono text-[10px] text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                                          {cIdx + 1}
                                        </span>
                                        <p className="flex-1">{comment}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Summaries blocks */}
                                {job.remark && (
                                  <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl mt-1">
                                    <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-slate-200">
                                      {mode === 'ai' ? (
                                        <>
                                          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                                          AI 槽点总结
                                        </>
                                      ) : (
                                        <>
                                          <Cpu className="h-3.5 w-3.5 text-slate-400" />
                                          备注回写汇总预览
                                        </>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-200 leading-normal font-medium pl-5">
                                      “ {job.remark} ”
                                    </p>
                                  </div>
                                )}

                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
