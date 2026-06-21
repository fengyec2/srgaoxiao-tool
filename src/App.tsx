/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AnimatePresence } from 'motion/react';
import { SchoolJob, FileData, ProcessingMode } from './types';

// Import modular sub-components
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { FileUploader } from './components/FileUploader';
import { CrawlerConfigCard } from './components/CrawlerConfigCard';
import { ControlPanel } from './components/ControlPanel';
import { StatsDashboard } from './components/StatsDashboard';
import { ExportCard } from './components/ExportCard';
import { JobListTable } from './components/JobListTable';
import { CustomDialog } from './components/CustomDialog';

export default function App() {
  // File state (restored from browser storage)
  const [fileData, setFileData] = useState<FileData | null>(() => {
    try {
      const saved = localStorage.getItem('crawler_file_data');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [selectedColIndex, setSelectedColIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('crawler_selected_col_index');
      return saved ? Number(saved) : -1;
    } catch {
      return -1;
    }
  });

  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Crawler config (restored from browser storage)
  const [mode, setMode] = useState<ProcessingMode>(() => {
    try {
      const saved = localStorage.getItem('crawler_mode');
      return (saved as ProcessingMode) || 'local';
    } catch {
      return 'local';
    }
  });

  const [concurrency, setConcurrency] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('crawler_concurrency');
      return saved ? Number(saved) : 3;
    } catch {
      return 3;
    }
  });

  const [aiBatchSize, setAiBatchSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('crawler_ai_batch_size');
      return saved ? Number(saved) : 15;
    } catch {
      return 15;
    }
  });

  const [aiBatchInterval, setAiBatchInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('crawler_ai_batch_interval');
      return saved ? Number(saved) : 10; // Default set to 10s as requested
    } catch {
      return 10;
    }
  });

  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('crawler_custom_prompt');
      return saved || '你是一个中国高校舆情和网友曝光评论的深度总结专家。请分别为下面的几所高校，根据提供的吐槽和爆料评论，写出一个 60 字以内高水平、客观简明的吐槽一句话总结（千万不要编造内容，仅对提供的讨论事实进行中立归纳）。语气中立客观，不要带有前缀（例如“总结：”、“根据评论：”等），不废话，直接给出高信息浓度的总结。';
    } catch {
      return '你是一个中国高校舆情和网友曝光评论的深度总结专家。请分别为下面的几所高校，根据提供的吐槽和爆料评论，写出一个 60 字以内高水平、客观简明的吐槽一句话总结（千万不要编造内容，仅对提供的讨论事实进行中立归纳）。语气中立客观，不要带有前缀（例如“总结：”、“根据评论：”等），不废话，直接给出高信息浓度的总结。';
    }
  });

  const [lowEffects, setLowEffects] = useState<boolean>(() => {
    try {
      return localStorage.getItem('low_effects_mode') === 'true';
    } catch {
      return false;
    }
  });

  const toggleLowEffects = () => {
    const nextVal = !lowEffects;
    setLowEffects(nextVal);
    try {
      localStorage.setItem('low_effects_mode', String(nextVal));
    } catch (err) {
      console.warn('LocalStorage error:', err);
    }
  };

  // Dialog (alert/confirm) state matching page level double verification
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'alert';
    title: string;
    message: string;
    onConfirm: () => void;
    cancelText?: string;
    confirmText?: string;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showAlert = (title: string, message: string, onConfirm: () => void = () => {}) => {
    setDialog({
      isOpen: true,
      type: 'alert',
      title,
      message,
      onConfirm: () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      confirmText: '我知道了',
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText?: string) => {
    setDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm: () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      cancelText: '取消',
      confirmText: confirmText || '确认',
    });
  };

  // Crawler processing state
  const [jobs, setJobs] = useState<SchoolJob[]>(() => {
    try {
      const saved = localStorage.getItem('crawler_jobs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Time & Speed counters
  const [elapsedTime, setElapsedTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('crawler_elapsed_time');
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });
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
  const aiBatchSizeRef = useRef<number>(aiBatchSize);
  const aiBatchIntervalRef = useRef<number>(aiBatchInterval);
  const customPromptRef = useRef<string>(customPrompt);

  // Keep references in sync with state to avoid stale closure under async workers
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    jobsRef.current = jobs;
    try {
      if (jobs && jobs.length > 0) {
        localStorage.setItem('crawler_jobs', JSON.stringify(jobs));
      } else {
        localStorage.removeItem('crawler_jobs');
      }
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [jobs]);

  useEffect(() => {
    concurrencyRef.current = concurrency;
    try {
      localStorage.setItem('crawler_concurrency', String(concurrency));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [concurrency]);

  useEffect(() => {
    modeRef.current = mode;
    try {
      localStorage.setItem('crawler_mode', mode);
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [mode]);

  useEffect(() => {
    aiBatchSizeRef.current = aiBatchSize;
    try {
      localStorage.setItem('crawler_ai_batch_size', String(aiBatchSize));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [aiBatchSize]);

  useEffect(() => {
    aiBatchIntervalRef.current = aiBatchInterval;
    try {
      localStorage.setItem('crawler_ai_batch_interval', String(aiBatchInterval));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [aiBatchInterval]);

  useEffect(() => {
    customPromptRef.current = customPrompt;
    try {
      localStorage.setItem('crawler_custom_prompt', customPrompt);
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [customPrompt]);

  useEffect(() => {
    try {
      if (fileData) {
        localStorage.setItem('crawler_file_data', JSON.stringify(fileData));
      } else {
        localStorage.removeItem('crawler_file_data');
      }
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [fileData]);

  useEffect(() => {
    try {
      localStorage.setItem('crawler_selected_col_index', String(selectedColIndex));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [selectedColIndex]);

  useEffect(() => {
    try {
      localStorage.setItem('crawler_elapsed_time', String(elapsedTime));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [elapsedTime]);

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
          showAlert('文件解析提示', '您上传的表格为空或格式不正确！');
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
        showAlert('解析失败', `解析高校名单表格文件时发生错误: ${err.message || err}`);
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
        showAlert('格式不支持', '您上传的文件格式不正确，本系统仅支持上传 .xlsx, .xls 或 .csv 类型的手动或推荐表格文件！');
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

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Run batch AI summarization in chunks of colleges to keep prompt size ideal and eliminate any rate-limits
  const runBatchAiSummarization = async (scrapedJobs: SchoolJob[]) => {
    // 1. Mark all scraped jobs as 'analyzing' to give visual progress cues
    const updatedJobs = [...jobsRef.current];
    scrapedJobs.forEach(job => {
      const target = updatedJobs.find(j => j.id === job.id);
      if (target) {
        target.status = 'analyzing';
        target.error = '排队等待 AI 批量提炼中...';
      }
    });
    setJobs(updatedJobs);

    const batchSize = aiBatchSizeRef.current;
    const cooldownMs = aiBatchIntervalRef.current * 1000;
    
    for (let i = 0; i < scrapedJobs.length; i += batchSize) {
      if (!isRunningRef.current) break;

      const batch = scrapedJobs.slice(i, i + batchSize);
      
      // Update the current batch status
      const updatedWithProgress = [...jobsRef.current];
      batch.forEach(job => {
        const target = updatedWithProgress.find(j => j.id === job.id);
        if (target) {
          target.error = `AI 提炼中 (${Math.floor(i / batchSize) + 1}/${Math.ceil(scrapedJobs.length / batchSize)} 组)...`;
        }
      });
      setJobs(updatedWithProgress);

      try {
        const response = await fetch('/api/ai-summarize-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schools: batch.map(b => ({
              id: b.id,
              name: b.name,
              comments: b.comments
            })),
            customPrompt: customPromptRef.current
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const latestJobs = [...jobsRef.current];

        if (data.isQuotaExceeded) {
          console.warn('Gemini API quota exceeded, gracefully degrading to local fallback...', data.errorMsg);
          batch.forEach(b => {
            const target = latestJobs.find(j => j.id === b.id);
            if (target) {
              const fallText = (b.comments || []).slice(0, 2).join('; ');
              target.remark = fallText.substring(0, 18) + (fallText.length > 18 ? '...' : '');
              target.status = 'completed';
              target.error = 'API额度超载：已为您降级启用底层保障直录';
            }
          });
          setJobs(latestJobs);
          continue;
        }

        const results: Record<string, string> = data.results || {};

        batch.forEach(b => {
          const target = latestJobs.find(j => j.id === b.id);
          if (target) {
            const keyName = b.name;
            const summary = results[keyName];
            if (summary) {
              target.remark = summary;
              target.status = 'completed';
              target.error = null;
            } else {
              // Fallback if key missing in JSON
              const fallText = (b.comments || []).slice(0, 2).join('; ');
              target.remark = fallText.substring(0, 18) + (fallText.length > 18 ? '...' : '');
              target.status = 'completed';
              target.error = 'AI总结匹配名偏差，降级启用安全直录备注';
            }
          }
        });
        setJobs(latestJobs);

      } catch (error: any) {
        console.error('Batch summary chunk failed, fell back:', error);
        const latestJobs = [...jobsRef.current];
        batch.forEach(b => {
          const target = latestJobs.find(j => j.id === b.id);
          if (target) {
            const fallText = (b.comments || []).slice(0, 2).join('; ');
            target.remark = fallText.substring(0, 18) + (fallText.length > 18 ? '...' : '');
            target.status = 'completed';
            target.error = 'AI总结临时不可服务，已执行本地降级记录';
          }
        });
        setJobs(latestJobs);
      }

      // User-defined cooldown interval to comply with rate limits (and avoid spike traffic)
      if (i + batchSize < scrapedJobs.length && isRunningRef.current && cooldownMs > 0) {
        await sleep(cooldownMs);
      }
    }

    setIsRunning(false);
  };

  // Core Scheduler - Runs next available wait jobs
  const runNext = async () => {
    if (!isRunningRef.current) return;

    // Find first job with 'waiting' status
    const currentJobs = [...jobsRef.current];
    const nextJobIdx = currentJobs.findIndex(j => j.status === 'waiting');

    if (nextJobIdx === -1) {
      // No more jobs waiting for crawling. Check if any threads are still active in scraping stage
      const activeScraping = currentJobs.filter(j => j.status === 'scraping');
      if (activeScraping.length === 0) {
        // All web scraping is complete!
        const scrapedJobs = currentJobs.filter(j => j.status === 'scraped');
        if (scrapedJobs.length > 0 && modeRef.current === 'ai') {
          // Trigger Batch AI summarizes for all scraped schools in ONE call (or chunks)
          await runBatchAiSummarization(scrapedJobs);
        } else {
          setIsRunning(false);
        }
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
        // In AI Mode, phase 1 simply finishes and marks job as 'scraped'.
        // Phase 2 will execute Gemini summarization in batches once crawler settles down.
        jobToUpdate.status = 'scraped';
        jobToUpdate.remark = '';
        jobToUpdate.error = null;
        setJobs(updatedJobs);
      } else {
        // Local Mode - Extract top 3 direct comments stitched up
        const rawJoined = scrapeData.comments.slice(0, 3).join('；');
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

  // Reset entire system configurations with in-page custom double verification
  const resetConfigs = () => {
    showConfirm(
      '重置所有设置确认',
      '您确定要重置当前所有的配置参数吗？这包含：并发线程数、单次打包群数、组响应间隔延迟，并清空还原您的智能总结指令提示词。',
      () => {
        setConcurrency(3);
        setMode('local');
        setAiBatchSize(15);
        setAiBatchInterval(10);
        setCustomPrompt('你是一个中国高校舆情和网友曝光评论的深度总结专家。请分别为下面的几所高校，根据提供的吐槽和爆料评论，写出一个 60 字以内高水平、客观简明的吐槽一句话总结（千万不要编造内容，仅对提供的讨论事实进行中立归纳）。语气中立客观，不要带有前缀（例如“总结：”、“根据评论：”等），不废话，直接给出高信息浓度的总结。');
        
        try {
          localStorage.removeItem('crawler_concurrency');
          localStorage.removeItem('crawler_mode');
          localStorage.removeItem('crawler_ai_batch_size');
          localStorage.removeItem('crawler_ai_batch_interval');
          localStorage.removeItem('crawler_custom_prompt');
        } catch {}
        
        showAlert('重置成功', '所有的系统配置（批量数15，安全间隔10秒，重置大模型总结角色等）已恢复为最优推荐默认参数值并已写入缓存。');
      },
      '确定重置'
    );
  };

  // Reset/Clear controller
  const resetProcessing = () => {
    showConfirm(
      '重置舆情检索确认',
      '您确定要重置当前所有的检索进度和状态吗？重置后将清除已有的爬取详情与舆情曝光评论，需要重新对名单进行排查。',
      () => {
        setIsRunning(false);
        setElapsedTime(0);
        setEstRemaining(null);
        if (fileData) {
          initializeJobs(fileData.rows, selectedColIndex);
        }
      },
      '确定重置'
    );
  };

  // Quick stats computed on-the-fly
  const processedCount = jobs.filter(j => ['completed', 'not_found', 'failed', 'scraped', 'analyzing'].includes(j.status)).length;
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
      showAlert('导出失败', `导出分析结果到 Excel 时发生错误: ${err.message || err}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-x-hidden pt-0 pb-0">
      
      {/* Background Mesh Gradients */}
      {!lowEffects && (
        <>
          <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="absolute bottom-[-50px] left-[-50px] w-80 h-80 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none z-0" />
        </>
      )}

      {/* Header Bar */}
      <Header lowEffects={lowEffects} toggleLowEffects={toggleLowEffects} />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8 z-10 relative">
        
        {/* Step 1: Upload and settings column matching */}
        <AnimatePresence mode="popLayout">
          {!fileData ? (
            <FileUploader
              lowEffects={lowEffects}
              isDragOver={isDragOver}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              handleFile={handleFile}
            />
          ) : (
            <CrawlerConfigCard
              fileData={fileData}
              jobsCount={jobs.length}
              selectedColIndex={selectedColIndex}
              changeSelectedColumn={changeSelectedColumn}
              mode={mode}
              setMode={setMode}
              concurrency={concurrency}
              setConcurrency={setConcurrency}
              aiBatchSize={aiBatchSize}
              setAiBatchSize={setAiBatchSize}
              aiBatchInterval={aiBatchInterval}
              setAiBatchInterval={setAiBatchInterval}
              customPrompt={customPrompt}
              setCustomPrompt={setCustomPrompt}
              onResetConfigs={resetConfigs}
              isRunning={isRunning}
              lowEffects={lowEffects}
              onResetFile={() => {
                setFileData(null);
                setJobs([]);
                try {
                  localStorage.removeItem('crawler_file_data');
                  localStorage.removeItem('crawler_jobs');
                  localStorage.removeItem('crawler_selected_col_index');
                  localStorage.removeItem('crawler_elapsed_time');
                } catch {}
              }}
            />
          )}
        </AnimatePresence>

        {/* Process Status Dashboard */}
        {fileData && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 z-10 relative">
            
            {/* Left Box: Counters & Control Nodes */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              <ControlPanel
                isRunning={isRunning}
                startProcessing={startProcessing}
                pauseProcessing={pauseProcessing}
                resetProcessing={resetProcessing}
                processedCount={processedCount}
                totalCount={totalCount}
                percentComplete={percentComplete}
                estRemaining={estRemaining}
                lowEffects={lowEffects}
              />

              <StatsDashboard
                totalCount={totalCount}
                completedSuccess={completedSuccess}
                completedNotFound={completedNotFound}
                failedCount={failedCount}
                elapsedTime={elapsedTime}
                lowEffects={lowEffects}
              />

              <ExportCard
                handleExport={handleExport}
                disabled={processedCount === 0}
                lowEffects={lowEffects}
              />
            </div>

            {/* Right Box: University Job List table container */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <JobListTable
                jobs={jobs}
                expandedJobIds={expandedJobIds}
                toggleRowDetail={toggleRowDetail}
                mode={mode}
                lowEffects={lowEffects}
              />
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <Footer />

      {/* Custom dialog for alert and confirm validations */}
      <CustomDialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        onConfirm={dialog.onConfirm}
        onCancel={() => setDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
      />

    </div>
  );
}
