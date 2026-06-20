import React from 'react';
import { Download } from 'lucide-react';

interface ExportCardProps {
  handleExport: () => void;
  disabled: boolean;
  lowEffects: boolean;
}

export const ExportCard: React.FC<ExportCardProps> = ({
  handleExport,
  disabled,
  lowEffects,
}) => {
  return (
    <div
      id="export-card-actions-widget"
      className={`${
        lowEffects ? 'bg-slate-900 shadow-md' : 'bg-slate-900/40 backdrop-blur-md shadow-2xl'
      } border border-white/10 rounded-2xl p-5 flex flex-col gap-3 text-slate-200`}
    >
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">结果回写导出</h4>
      <p className="text-[11px] text-slate-400">
        基于上传的导入表格，在最后一列追加新建“备注”列，写入已检索的高校负面舆情或AI摘要结果。
      </p>
      <button
        id="export-xlsx-report-btn"
        onClick={handleExport}
        disabled={disabled}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-40 disabled:shadow-none ${
          lowEffects ? '' : 'shadow-lg shadow-green-500/20'
        }`}
      >
        <Download className="h-4 w-4" />
        导出已更新的表格报告 (.xlsx)
      </button>
    </div>
  );
};
