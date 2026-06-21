import React from 'react';
import { Play, Pause, RotateCcw, Loader2 } from 'lucide-react';

interface ControlPanelProps {
  isRunning: boolean;
  startProcessing: () => void;
  pauseProcessing: () => void;
  resetProcessing: () => void;
  processedCount: number;
  totalCount: number;
  percentComplete: number;
  estRemaining: number | null;
  lowEffects: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRunning,
  startProcessing,
  pauseProcessing,
  resetProcessing,
  processedCount,
  totalCount,
  percentComplete,
  estRemaining,
  lowEffects,
}) => {
  return (
    <div
      id="control-panel-card"
      className={`${
        lowEffects ? 'bg-slate-900 shadow-md' : 'bg-slate-900/40 backdrop-blur-md shadow-2xl'
      } border border-white/10 rounded-2xl p-5 flex flex-col gap-4 text-slate-200`}
    >
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">控制面板</h4>
      
      <div className="flex flex-col gap-2.5">
        {!isRunning ? (
          <button
            id="start-crawler-btn"
            onClick={startProcessing}
            disabled={totalCount === 0}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl text-sm transition-all ${
              lowEffects ? '' : 'shadow-lg shadow-blue-500/20'
            } hover:bg-blue-500 disabled:opacity-40 disabled:shadow-none`}
          >
            <Play className="h-4 w-4 fill-white text-white" />
            开始舆情检索
          </button>
        ) : (
          <button
            id="pause-crawler-btn"
            onClick={pauseProcessing}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white font-semibold rounded-xl text-sm transition-all ${
              lowEffects ? '' : 'shadow-lg shadow-amber-500/20'
            } hover:bg-amber-600`}
          >
            <Pause className="h-4 w-4 fill-white text-white" />
            暂停当前作业
          </button>
        )}

        <button
          id="reset-crawler-btn"
          onClick={resetProcessing}
          disabled={processedCount === 0 && !isRunning}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 font-medium rounded-xl text-xs border border-white/10 transition-colors disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置检索进度
        </button>
      </div>

      {/* Progress bar inside controls */}
      <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>当前整体进度</span>
          <span className="font-semibold text-slate-200">{percentComplete}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
          <div
            id="progress-bar-fill"
            className={`h-full transition-all duration-300 ${
              isRunning 
                ? (lowEffects ? 'bg-blue-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500') 
                : 'bg-slate-600'
            }`}
            style={{ width: `${percentComplete}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400">
          <span>已完成 {processedCount} / {totalCount}</span>
          {isRunning && estRemaining !== null && (
            <span className="flex items-center gap-1">
              <Loader2 className={`h-3 w-3 text-blue-400 ${lowEffects ? '' : 'animate-spin'}`} />
              预计余下 {estRemaining} 秒
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
