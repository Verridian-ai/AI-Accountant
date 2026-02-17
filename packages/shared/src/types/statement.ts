export interface Statement {
  id: string;
  filename: string;
  hash: string;
  uploadDate: string;
  parsingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  aiModelUsed: string | null;
  errorMessage?: string | null;
  errorType?: 'PDF_READ_ERROR' | 'AI_PARSE_ERROR' | 'EMPTY_STATEMENT' | 'CRITICAL_ERROR' | null;
  errorDetails?: string | null;
  userId: string | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  transactionCount?: number | null;
  isComplete?: boolean;
  validationErrors?: string | null;
}

export interface StatementGapAnalysis {
  coverage: {
    earliestDate: string | null;
    latestDate: string | null;
    totalStatements: number;
    totalGaps: number;
    totalOverlaps: number;
    totalBalanceMismatches: number;
    hasIssues: boolean;
  };
  gaps: Array<{
    accountId: string | null;
    gapStart: string;
    gapEnd: string;
    gapDays: number;
    beforeStatement: string | null;
    afterStatement: string | null;
  }>;
  overlaps: Array<{
    accountId: string | null;
    statement1: string;
    statement2: string;
    overlapStart: string;
    overlapEnd: string;
    overlapDays: number;
  }>;
  balanceMismatches: Array<{
    accountId: string | null;
    statement1: string;
    statement2: string;
    expectedBalance: number;
    actualBalance: number;
    difference: number;
  }>;
  statements: Array<{
    id: string;
    filename: string;
    periodStartDate: string | null;
    periodEndDate: string | null;
    openingBalance: number | null;
    closingBalance: number | null;
    transactionCount: number | null;
    parsingStatus: string;
    accountId: string | null;
  }>;
}

export interface BatchFileStatus {
  id: string;
  filename: string;
  state: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  statementId?: string;
  error?: string;
  retryCount?: number;
}

export interface BatchUploadResponse {
  message: string;
  jobId: string;
  fileCount: number;
  files: BatchFileStatus[];
}

export interface BatchJobStatus {
  id: string;
  state: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
  };
  files: BatchFileStatus[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

