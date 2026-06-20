export interface SchoolJob {
  id: string;
  name: string; // The school name extracted from column
  rowIndex: number; // Row index in the original file
  status: 'waiting' | 'scraping' | 'analyzing' | 'completed' | 'not_found' | 'failed';
  matchedName: string | null;
  matchedUrl: string | null;
  comments: string[];
  remark: string; // Negative summary or first few comments
  error: string | null;
}

export interface FileData {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: any[][]; // Raw rows parsed from excel/csv (including header at index 0)
  detectedColIndex: number; // Automatically detected index for university names
}

export type ProcessingMode = 'local' | 'ai';
