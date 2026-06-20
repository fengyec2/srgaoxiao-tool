import React from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { motion } from 'motion/react';

interface FileUploaderProps {
  lowEffects: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  handleFile: (file: File) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  lowEffects,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  handleFile,
}) => {
  return (
    <motion.div
      id="file-dropzone-uploader"
      layoutId={lowEffects ? undefined : "upload-card"}
      initial={lowEffects ? {} : { opacity: 0, y: 15 }}
      animate={lowEffects ? {} : { opacity: 1, y: 0 }}
      exit={lowEffects ? {} : { opacity: 0, y: -15 }}
      transition={lowEffects ? { duration: 0 } : undefined}
      className={`${
        lowEffects ? 'bg-slate-900' : 'bg-slate-900/40 backdrop-blur-2xl'
      } border border-white/10 p-8 shadow-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-blue-500/50 group relative overflow-hidden z-10`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => {
        const el = document.getElementById('excel-file-uploader');
        if (el) el.click();
      }}
    >
      {/* Decorative dash pattern hover effect */}
      <div className={`absolute inset-0 border border-dashed rounded-2xl transition-colors duration-200 ${isDragOver ? 'border-blue-500 bg-blue-500/5' : 'border-white/5'}`} />

      <input
        id="excel-file-uploader"
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) handleFile(files[0]);
        }}
      />

      <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-4 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
        <Upload className="h-8 w-8" />
      </div>

      <h3 className="text-base font-semibold text-slate-200">导入您有意向的高校表格</h3>
      <p className="text-sm text-slate-400 max-w-md mt-1.5 mb-6">
        支持上传 Excel (.xlsx, .xls) 或 CSV (.csv) 数据表文件。
        导入后系统会自动扫描匹配包含高校名称的列。
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <span className="text-xs text-slate-400 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 flex items-center gap-1">
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
          Excel 格式支持
        </span>
        <span className="text-xs text-slate-400 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 flex items-center gap-1">
          <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400" />
          CSV 格式支持
        </span>
      </div>
    </motion.div>
  );
};
