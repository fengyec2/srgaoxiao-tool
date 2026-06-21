import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface CustomDialogProps {
  isOpen: boolean;
  type: 'confirm' | 'alert';
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({
  isOpen,
  type,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确定',
  cancelText = '取消',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity" 
        onClick={type === 'confirm' ? onCancel : onConfirm}
      />
      
      {/* Modal Box */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-0 right-0 p-4">
          <button 
            type="button"
            onClick={type === 'confirm' ? onCancel : onConfirm}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-4 items-start">
          <div className={`p-3 rounded-xl shrink-0 ${
            type === 'confirm' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
          }`}>
            {type === 'confirm' ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <Info className="h-6 w-6" />
            )}
          </div>
          
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed whitespace-pre-line">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          {type === 'confirm' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-semibold rounded-xl text-slate-300 border border-white/5 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              type === 'confirm' 
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/10' 
                : 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/10'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
