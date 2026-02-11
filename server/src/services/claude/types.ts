/**
 * Claude Agent Framework — Shared Types
 *
 * All types and interfaces for the Claude agent system.
 */

import type { BankId, AccountInfo, ParsedTransaction } from '../parsers/types.js';

// Agent type union
export type AgentType =
  | 'statement_parser'
  | 'transaction_categorizer'
  | 'gst_calculator'
  | 'account_reconciler'
  | 'budget_analyzer'
  | 'cross_account_tracer'
  | 'merchant_intelligence';

// Token budget per agent
export interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxToolCalls: number;
  warningThresholdPercent: number;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Agent progress event for SSE
export interface AgentProgressEvent {
  type: 'agent_progress';
  agent: AgentType;
  status: 'started' | 'tool_call' | 'completed' | 'error';
  data?: Record<string, unknown>;
  timestamp: string;
}

// Token usage tracking
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
}

// --- Agent I/O Contracts ---

// 3.1 StatementParser
export interface StatementParserInput {
  statementId: number;
  extractedText: string;
  extractedImages?: string[];
  fileName: string;
}

export interface StatementParserOutput {
  bankId: BankId;
  bankConfidence: number;
  accountInfo: AccountInfo;
  transactions: ParsedTransaction[];
  parseMethod: 'bank_parser' | 'ai_vision' | 'ai_text';
  warnings: string[];
}

// 3.2 TransactionCategorizer
export interface CategorizerInput {
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
    accountId: number;
    bankId: BankId;
  }>;
  existingMerchantMemory: Array<{
    pattern: string;
    category: string;
    gst: boolean;
  }>;
}

export interface CategorizerOutput {
  results: Array<{
    transactionId: number;
    category: string;
    subCategory?: string;
    confidence: number;
    gstCategory: string;
    gstAmount?: number;
    aiReasoningNotes: string;
    merchantKey?: string;
    isRecurring?: boolean;
  }>;
  lowConfidenceIds: number[];
}

// 3.3 GSTCalculator
export interface GSTCalculatorInput {
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
    category?: string;
    gstCategory?: string;
  }>;
  quarter: { year: number; quarter: 1 | 2 | 3 | 4 };
  accountId?: number;
  includePayg?: boolean;
}

export interface GSTCalculatorOutput {
  basLabels: {
    G1: number;
    G2: number;
    G3: number;
    G10: number;
    G11: number;
    '1A': number;
    '1B': number;
    W1: number;
    W2: number;
    '5A': number;
    '7C': number;
    '7D': number;
  };
  gstPayable: number;
  totalPayable: number;
  transactionBreakdown: {
    gstApplicable: number;
    gstFree: number;
    inputTaxed: number;
    capitalAcquisitions: number;
    outOfScope: number;
  };
  warnings: string[];
}

// 3.4 AccountReconciler
export interface ReconcilerInput {
  accountId: number;
  statementIds?: number[];
  includeTransferDetection?: boolean;
  accounts?: Array<{
    id: number;
    accountNumber: string;
    bankId: string;
    accountName?: string;
  }>;
}

export interface ReconcilerOutput {
  status: 'clean' | 'warnings' | 'errors';
  duplicates: Array<{
    transaction1Id: number;
    transaction2Id: number;
    confidence: number;
    reason: string;
  }>;
  balanceContinuity: {
    isContiguous: boolean;
    gaps: Array<{
      afterStatement: number;
      expectedOpening: number;
      actualOpening: number;
    }>;
  };
  transferMatches: Array<{
    sourceTransactionId: number;
    targetTransactionId: number;
    amount: number;
    confidence: number;
    matchReasons: string[];
  }>;
  unmatchedTransactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
  }>;
  runningBalanceErrors: Array<{
    transactionId: number;
    expected: number;
    actual: number;
  }>;
  summary: string;
}

// 3.5 BudgetAnalyzer
export interface BudgetAnalyzerInput {
  accountIds: number[];
  dateRange?: { start: string; end: string };
  focusAreas?: ('spending' | 'income' | 'savings' | 'recurring' | 'anomalies')[];
  includeProjections?: boolean;
}

export interface BudgetAnalyzerOutput {
  insights: Array<{
    type: 'spending' | 'income' | 'savings' | 'warning' | 'opportunity';
    title: string;
    description: string;
    amount?: number;
    trend?: 'up' | 'down' | 'stable';
    confidence: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    total: number;
    percentage: number;
    monthOverMonth: number;
  }>;
  recurringExpenses: Array<{
    description: string;
    amount: number;
    frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual';
    nextExpected: string;
  }>;
  projections?: Array<{
    month: string;
    projectedBalance: number;
    confidence: number;
  }>;
  savingsRate: number;
  summary: string;
}

// 3.6 CrossAccountTracer
export interface CrossAccountTracerInput {
  accountIds: number[];
  dateRange?: { start: string; end: string };
  config?: {
    matchWindowDays?: number;
    amountToleranceCents?: number;
    minConfidence?: number;
  };
  includeFlowDiagram?: boolean;
}

export interface CrossAccountTracerOutput {
  transfers: Array<{
    sourceAccountId: number;
    targetAccountId: number;
    sourceTransactionId: number;
    targetTransactionId: number;
    amount: number;
    date: string;
    confidence: number;
    matchReasons: string[];
  }>;
  multiHopChains: Array<{
    path: number[];
    totalAmount: number;
    transactionIds: number[];
  }>;
  netFlows: Array<{
    fromAccountId: number;
    toAccountId: number;
    netAmount: number;
    transactionCount: number;
  }>;
  flowDiagram?: string;
  summary: string;
}

// 3.7 MerchantIntelligence
export interface MerchantIntelligenceInput {
  merchants: Array<{
    transactionId: number;
    description: string;
    amount: number;
    category?: string;
  }>;
  existingMappings: Array<{
    pattern: string;
    displayName: string;
    abn?: string;
    gstRegistered?: boolean;
    category?: string;
  }>;
}

export interface MerchantIntelligenceOutput {
  results: Array<{
    transactionId: number;
    abbreviatedName: string;
    canonicalName: string;
    abn?: string;
    gstRegistered: boolean;
    industry?: string;
    defaultCategory: string;
    confidence: number;
    source: 'cognee' | 'online' | 'pattern' | 'unknown';
  }>;
  newMappings: Array<{
    abbreviatedName: string;
    canonicalName: string;
    abn?: string;
    gstRegistered: boolean;
    industry?: string;
    defaultCategory: string;
  }>;
  summary: string;
}
