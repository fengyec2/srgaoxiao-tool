import React from 'react';
import { Layers, Cpu, ExternalLink } from 'lucide-react';

interface HeaderProps {
  lowEffects: boolean;
  toggleLowEffects: () => void;
}

export const Header: React.FC<HeaderProps> = ({ lowEffects, toggleLowEffects }) => {
  return (
    <header className={`border-b border-white/10 sticky top-0 z-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 ${
      lowEffects ? 'bg-slate-900 shadow-md' : 'bg-slate-900/40 backdrop-blur-2xl'
    }`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h1 id="app-title" className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            神人高校评论检索器
            <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v1.2 FullStack
            </span>
          </h1>
          <p className="text-xs text-slate-400">一键检索并多线程采集高校在“神人高校网”上的负面或争议性曝光内容</p>
        </div>
      </div>

      {/* Header Links & status */}
      <div className="flex items-center gap-3">
        {/* Low Effects Toggle Button */}
        <button
          id="toggle-low-effects-btn"
          onClick={toggleLowEffects}
          className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
            lowEffects
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-white/5 text-slate-400 border-white/10 hover:text-blue-400 hover:border-white/20 hover:bg-white/10'
          }`}
          title={lowEffects ? "极简模式已开启：已关闭网页发光背景及高开销动画" : "开启极简模式：减弱/关闭页面大型模糊背景与动效以显著降低CPU与GPU负载"}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>{lowEffects ? "已开启低负载/省电模式" : "省电低效能模式"}</span>
        </button>

        <a
          id="direct-to-site-link"
          href="https://srgaoxiao.com"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-slate-400 hover:text-blue-400 hover:bg-white/5 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg border border-transparent hover:border-white/5"
        >
          <span>直达神人高校网</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </header>
  );
};
