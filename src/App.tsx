/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  FileSpreadsheet,
  Play,
  Pause,
  RotateCcw,
  Download,
  AlertTriangle,
  Cpu,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  Hourglass,
  Layers,
  Activity,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Sliders,
  Settings,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { SchoolJob, FileData, ProcessingMode } from './types';

export default function App() {
  // File state
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [selectedColIndex, setSelectedColIndex] = useState<number>(-1);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Crawler config
  const [mode, setMode] = useState<ProcessingMode>('local');
  const [concurrency, setConcurrency] = useState<number>(3); // "Threads" counts

  // Crawler processing state
  const [jobs, setJobs] = useState<SchoolJob[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stats, setStats] = useState({
    success: 0,
    notFound: 0,
    failed: 0,
    total: 0
  });

  // Time & Speed counters
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [estRemaining, setEstRemaining] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Expanded card/row IDs for details inspection
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());

  // Concurrency & queue reference controls
  const isRunningRef = useRef<boolean>(isRunning);
  const jobsRef = useRef<SchoolJob[]>([]);
  const concurrencyRef = useRef<number>(concurrency);
  const modeRef = useRef<ProcessingMode>(mode);

  // Keep references in sync with state to avoid stale closure under async workers
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    concurrencyRef.current = concurrency;
  }, [concurrency]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Synchronous timer trigger
  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now() - (elapsedTime * 1000);
      }
      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedTime(seconds);

          // Calculate speed and ETA
          const doneCount = jobsRef.current.filter(j =>
            ['completed', 'not_found', 'failed'].includes(j.status)
          ).length;
          const totalJobs = jobsRef.current.length;

          if (doneCount > 0 && totalJobs > doneCount && seconds > 0) {
            const speed = doneCount / seconds; // jobs/sec
            const remaining = totalJobs - doneCount;
            const eta = Math.ceil(remaining / speed);
            setEstRemaining(eta);
          } else {
            setEstRemaining(null);
          }
        }
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      startTimeRef.current = null;
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRunning]);

  // Handle spreadsheet file parsing
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse raw rows (including header)
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (rawRows.length === 0) {
          alert('表格为空或格式不正确！');
          return;
        }

        const headers = (rawRows[0] || []).map(h => String(h || '').trim());
        
        // Auto match rules (Find keywords like 学校, 高校, 大学, 校名 etc.)
        const matchKeywords = ['学校', '高校', '大学', '名称', '校名', 'school', 'university', 'college', 'name', 'academy'];
        let detectedIndex = headers.findIndex(h => {
          if (!h || typeof h !== 'string') return false;
          const lower = h.toLowerCase();
          return matchKeywords.some(kw => lower.includes(kw));
        });

        // Fallback to first column if no keyword is found
        if (detectedIndex === -1) {
          detectedIndex = 0;
        }

        setFileData({
          fileName: file.name,
          fileSize: file.size,
          headers,
          rows: rawRows,
          detectedColIndex: detectedIndex
        });

        setSelectedColIndex(detectedIndex);
        initializeJobs(rawRows, detectedIndex);

      } catch (err: any) {
        console.error(err);
        alert(`解析文件失败: ${err.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Convert parsed sheet rows to jobs list with deduplication of school names
  const initializeJobs = (rows: any[][], colIdx: number) => {
    const initializedJobs: SchoolJob[] = [];
    const seenNames = new Set<string>();

    // Index 0 represents the column headers, so we start from row 1
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const nameVal = row[colIdx];
      const cleanName = nameVal ? String(nameVal).trim() : '';

      if (cleanName) {
        const lowerName = cleanName.toLowerCase();
        if (seenNames.has(lowerName)) {
          // Skip if this school name is already added to avoid redundant scraping
          continue;
        }
        seenNames.add(lowerName);

        initializedJobs.push({
          id: `row-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: cleanName,
          rowIndex: i,
          status: 'waiting',
          matchedName: null,
          matchedUrl: null,
          comments: [],
          remark: '',
          error: null
        });
      }
    }
    setJobs(initializedJobs);
    setExpandedJobIds(new Set());
    // Reset stats & timers
    setElapsedTime(0);
    setEstRemaining(null);
    setIsRunning(false);
  };

  // Drag and drop events
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const ext = file?.name ? file.name.split('.').pop()?.toLowerCase() : '';
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        handleFile(file);
      } else {
        alert('仅支持上传 .xlsx, .xls 或 .csv 文件！');
      }
    }
  };

  // Manual change of university column selection
  const changeSelectedColumn = (idx: number) => {
    setSelectedColIndex(idx);
    if (fileData) {
      initializeJobs(fileData.rows, idx);
    }
  };

  // Core Scheduler - Runs next available wait jobs
  const runNext = async () => {
    if (!isRunningRef.current) return;

    // Find first job with 'waiting' status
    const currentJobs = [...jobsRef.current];
    const nextJobIdx = currentJobs.findIndex(j => j.status === 'waiting');

    if (nextJobIdx === -1) {
      // No more jobs waiting. Let's check if all are completed/failed to wrap up
      const activeJobs = currentJobs.filter(j => ['scraping', 'analyzing'].includes(j.status));
      if (activeJobs.length === 0) {
        setIsRunning(false);
      }
      return;
    }

    // Set status to scraping
    const targetJob = currentJobs[nextJobIdx];
    targetJob.status = 'scraping';
    setJobs([...currentJobs]);

    try {
      // 1. Scrape data
      const scrapeRes = await fetch(`/api/scrape-school?name=${encodeURIComponent(targetJob.name)}`);
      if (!scrapeRes.ok) {
        throw new Error(`Scraper Error status: ${scrapeRes.status}`);
      }

      const scrapeData = await scrapeRes.json();
      const updatedJobs = [...jobsRef.current];
      const jobToUpdate = updatedJobs.find(j => j.id === targetJob.id);

      if (!jobToUpdate) return;

      jobToUpdate.matchedName = scrapeData.matchedSchoolName || null;
      jobToUpdate.matchedUrl = scrapeData.matchedUrl || null;
      jobToUpdate.comments = scrapeData.comments || [];

      if (!scrapeData.matched || scrapeData.comments.length === 0) {
        // No matching entry or comments
        jobToUpdate.status = 'not_found';
        jobToUpdate.remark = '神人高校网未查到舆情或吐槽曝光记录。';
        setJobs(updatedJobs);
        // Continue loop
        runNext();
        return;
      }

      // 2. Process findings under selected mode (Local vs AI)
      if (modeRef.current === 'ai') {
        // AI summarizes negative reviews
        jobToUpdate.status = 'analyzing';
        setJobs([...updatedJobs]);

        const aiRes = await fetch('/api/ai-summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolName: targetJob.name,
            comments: scrapeData.comments
          })
        });

        const latestJobs = [...jobsRef.current];
        const jobToSum = latestJobs.find(j => j.id === targetJob.id);
        if (!jobToSum) return;

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          jobToSum.remark = aiData.summary || '无负面舆情总结';
          jobToSum.status = 'completed';
        } else {
          // Fallback to local concatenated keywords if AI summaries fail
          const fallText = scrapeData.comments.slice(0, 2).join('; ');
          jobToSum.remark = fallText.substring(0, 18) + (fallText.length > 18 ? '...' : '');
          jobToSum.status = 'completed';
          jobToSum.error = 'AI 总结临时接口异常，已降级启用本地直录备注';
        }
        setJobs(latestJobs);

      } else {
        // Local Mode - Extract top 3 direct comments stitched up
        const rawJoined = scrapeData.comments.slice(0, 3).join('；');
        // Bound length or format neatly
        jobToUpdate.remark = rawJoined.length > 50 
          ? rawJoined.substring(0, 48) + '...' 
          : rawJoined;
        jobToUpdate.status = 'completed';
        setJobs(updatedJobs);
      }

    } catch (err: any) {
      console.error(`Job processing failed for ${targetJob.name}:`, err);
      const updatedJobs = [...jobsRef.current];
      const failedJob = updatedJobs.find(j => j.id === targetJob.id);
      if (failedJob) {
        failedJob.status = 'failed';
        failedJob.error = err.message || String(err);
        failedJob.remark = '检索过程发生断网或其他系统异常';
      }
      setJobs(updatedJobs);
    }

    // Spawn recursion to process next queue
    runNext();
  };

  // Launch controller
  const startProcessing = () => {
    if (jobs.length === 0) return;

    setIsRunning(true);
    // Sync references and kick off concurrent threads
    setTimeout(() => {
      const threadCount = concurrencyRef.current;
      for (let t = 0; t < threadCount; t++) {
        runNext();
      }
    }, 50);
  };

  // Pause controller
  const pauseProcessing = () => {
    setIsRunning(false);
  };

  // Reset/Clear controller
  const resetProcessing = () => {
    if (window.confirm('您确定要重置当前所有的检索进度和状态吗？')) {
      setIsRunning(false);
      setElapsedTime(0);
      setEstRemaining(null);
      if (fileData) {
        initializeJobs(fileData.rows, selectedColIndex);
      }
    }
  };

  // Quick stats computed on-the-fly
  const processedCount = jobs.filter(j => ['completed', 'not_found', 'failed'].includes(j.status)).length;
  const completedSuccess = jobs.filter(j => j.status === 'completed').length;
  const completedNotFound = jobs.filter(j => j.status === 'not_found').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;
  const totalCount = jobs.length;
  const percentComplete = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  // Toggle rows details drawer collapse
  const toggleRowDetail = (id: string) => {
    const nextSet = new Set(expandedJobIds);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    setExpandedJobIds(nextSet);
  };

  // Export updated spreadsheet mapping matching rows
  const handleExport = () => {
    if (!fileData || jobs.length === 0) return;

    try {
      // Reconstitute matrix rows
      const originalRows = fileData.rows;
      const headers = [...originalRows[0]];
      
      // Determine columns indices
      let remarkColIndex = headers.indexOf('备注');
      if (remarkColIndex === -1) {
        // Insert at last index
        headers.push('备注');
        remarkColIndex = headers.length - 1;
      }

      const matchingResultsMap = new Map<string, string>();
      jobs.forEach(job => {
        matchingResultsMap.set(job.name.toLowerCase().trim(), job.remark || '');
      });

      const updatedMatrix: any[][] = [];
      // Push compiled headers
      updatedMatrix.push(headers);

      // Populate row values mapping
      for (let i = 1; i < originalRows.length; i++) {
        const row = [...(originalRows[i] || [])];
        // Pad row array up to old headers size if it's shorter
        while (row.length < originalRows[0].length) {
          row.push('');
        }

        const nameVal = row[selectedColIndex];
        const cleanName = nameVal ? String(nameVal).trim() : '';
        const universityRemark = matchingResultsMap.get(cleanName.toLowerCase().trim()) || '';
        
        if (remarkColIndex < originalRows[0].length) {
          // Overwrite existing remark column values if any
          row[remarkColIndex] = universityRemark;
        } else {
          // Push new remark index
          row.push(universityRemark);
        }
        updatedMatrix.push(row);
      }

      // Cook Sheet workbook
      const ws = XLSX.utils.aoa_to_sheet(updatedMatrix);
      const wb = XLSX.utils.book_new();

      // Set elegant column widths
      const autoWidths = headers.map(header => {
        return { wch: header === '备注' ? 45 : 15 };
      });
      ws['!cols'] = autoWidths;

      XLSX.utils.book_append_sheet(wb, ws, '舆情检索报告');
      
      // Filename construction
      const parsedFilePrefix = fileData.fileName.substring(0, fileData.fileName.lastIndexOf('.')) || '高校名单';
      const outputFilename = `${parsedFilePrefix}_中神人高校舆情曝光报告.xlsx`;

      XLSX.writeFile(wb, outputFilename);

    } catch (err: any) {
      console.error(err);
      alert(`导出文件发生错误: ${err.message || err}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-x-hidden pt-0 pb-0">
      
      {/* Background Mesh Gradients */}
      <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-50px] left-[-50px] w-80 h-80 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Header Bar */}
      <header className="border-b border-white/10 bg-slate-900/40 backdrop-blur-2xl sticky top-0 z-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
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
          <a
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

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8 z-10 relative">
        
        {/* Step 1: Upload and settings column matching */}
        <AnimatePresence mode="popLayout">
          {!fileData ? (
            <motion.div
              layoutId="upload-card"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 shadow-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-blue-500/50 group relative overflow-hidden z-10"
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
          ) : (
            <motion.div
              layoutId="upload-card"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-6 shadow-2xl flex flex-col gap-6 text-slate-200 z-10"
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
                      成功读取 {fileData.rows.length - 1} 行记录（已自动去重保留 {jobs.length} 个唯一高校名称）。
                    </p>
                  </div>
                </div>

                {/* Change file target */}
                <button
                  onClick={() => {
                    setFileData(null);
                    setJobs([]);
                  }}
                  className="px-4 py-2 border border-white/10 text-xs font-medium rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  重选文件
                </button>
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
                      type="button"
                      onClick={() => setMode('local')}
                      className={`text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${mode === 'local' ? 'bg-white/10 text-white shadow-xs border border-white/10' : 'text-slate-400 hover:text-white'}`}
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      完全本地模式
                    </button>
                    <button
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

              {/* Advanced warning description */}
              {mode === 'ai' && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <strong>AI 模式精讲：</strong>采集神人高校网上对应的高校负面舆情评论后，服务器会自动调用 <strong>Gemini 3.5 Flash</strong> 大语言模型智能分析各暴露槽点，并全自动压缩为您一键可见的「极简备注评价（20字以内）」。此过程需要保持网络稳定。
                  </div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

        {/* Process Status Dashboard */}
        {fileData && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 z-10 relative">
            
            {/* Left Box: Counters & Control Nodes */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              
              {/* Controllers Widget */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-slate-200">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">控制面板</h4>
                
                <div className="flex flex-col gap-2.5">
                  {!isRunning ? (
                    <button
                      onClick={startProcessing}
                      disabled={jobs.length === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 hover:bg-blue-500 disabled:opacity-40 disabled:shadow-none"
                    >
                      <Play className="h-4 w-4 fill-white text-white" />
                      开始舆情检索
                    </button>
                  ) : (
                    <button
                      onClick={pauseProcessing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 hover:bg-amber-600"
                    >
                      <Pause className="h-4 w-4 fill-white text-white" />
                      暂停当前作业
                    </button>
                  )}

                  <button
                    onClick={resetProcessing}
                    disabled={processedCount === 0 && !isRunning}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 font-medium rounded-xl text-xs border border-white/10 transition-colors disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    重置所有人设
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
                      className={`h-full transition-all duration-300 ${isRunning ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-slate-600'}`}
                      style={{ width: `${percentComplete}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>已完成 {processedCount} / {totalCount}</span>
                    {isRunning && estRemaining !== null && (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                        预计余下 {estRemaining} 秒
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick statistics widgets */}
              <div className="bg-slate-900/40 backdrop-blur border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-slate-200">
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

              {/* Data exporter output widget */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-3 text-slate-200">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">结果回写导出</h4>
                <p className="text-[11px] text-slate-400">
                  基于上传的导入表格，在最后一列追加新建“备注”列，写入已检索的高校负面舆情或AI摘要结果。
                </p>
                <button
                  onClick={handleExport}
                  disabled={processedCount === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-green-500/20 transition-all disabled:opacity-40 disabled:shadow-none"
                >
                  <Download className="h-4 w-4" />
                  导出已更新的表格报告 (.xlsx)
                </button>
              </div>

            </div>

            {/* Right Box: University Job List table container */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              
              <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden flex-1 flex flex-col shadow-2xl text-slate-200">
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
                    <Hourglass className="h-12 w-12 text-slate-600 mb-2 animate-pulse" />
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
                                    <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 w-max animate-pulse font-medium">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      正在抓取舆情
                                    </span>
                                  )}
                                  {job.status === 'analyzing' && (
                                    <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1 w-max font-medium animate-pulse">
                                      <Sparkles className="h-3 w-3 animate-spin text-purple-400" />
                                      AI 提炼槽点...
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
                                    <td colSpan={6} className="bg-slate-950/40 p-0 border-b border-white/5">
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
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

            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 mt-12 bg-transparent text-center text-xs text-slate-500 z-10 relative">
        <p>神人高校评论检索器 © 2026. 本产品采集与总结分析之数据来源皆来自于公网神人高校网 (srgaoxiao.com)</p>
      </footer>

    </div>
  );
}

