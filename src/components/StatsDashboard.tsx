import React from 'react';
import { Activity } from 'lucide-react';

interface StatsDashboardProps {
  totalCount: number;
  completedSuccess: number;
  completedNotFound: number;
  failedCount: number;
  elapsedTime: number;
  lowEffects: boolean;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  totalCount,
  completedSuccess,
  completedNotFound,
  failedCount,
  elapsedTime,
  lowEffects,
}) => {
  return (
    <div
      id="stats-dashboard-card"
      className={`${
        lowEffects ? 'bg-slate-900 shadow-md' : 'bg-slate-900/40 backdrop-blur border shadow-2xl'
      } border border-white/10 rounded-2xl p-5 flex flex-col gap-4 text-slate-200`}
    >
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">采集数据统计</h4>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl">
          <span className="text-[10px] text-slate-400 font-medium">高校总计</span>
          <div className="text-lg font-semibold text-slate-100 mt-0.5">{totalCount}</div>
        </div>
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl">
          <span className="text-[10px] text-red-300 font-medium">舆情曝光高校</span>
          <div className="text-lg font-semibold text-red-400 mt-0.5">{completedSuccess}</div>
        </div>
        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-200 rounded-xl">
          <span className="text-[10px] text-green-300 font-medium">未发现舆情</span>
          <div className="text-lg font-semibold text-green-400 mt-0.5">{completedNotFound}</div>
        </div>
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-xl">
          <span className="text-[10px] text-amber-300 font-medium">检索失败</span>
          <div className="text-lg font-semibold text-amber-400 mt-0.5">{failedCount}</div>
        </div>
      </div>

      <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-slate-400" />
            当前运行计时
          </span>
          <span className="font-mono text-slate-200 font-medium">
            {Math.floor(elapsedTime / 60)}分 {elapsedTime % 60}秒
          </span>
        </div>
      </div>
    </div>
  );
};
