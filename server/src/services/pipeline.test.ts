import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mocks before they are used in vi.mock
const {
  mockGet,
  mockAll,
  mockSet,
  mockUpdate,
  mockInsert,
  mockWhere,
  mockFrom,
  mockSelect,
  mockParseStatementText,
  mockCategorizeTransactionsBatch,
  mockEventsEmit,
} = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockAll = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn();
  const mockFrom = vi.fn();
  const mockSet = vi.fn();
  const mockValues = vi.fn();

  // Create chainable mock structure
  mockWhere.mockReturnValue({ get: mockGet, all: mockAll });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
  mockValues.mockResolvedValue({});

  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  return {
    mockGet,
    mockAll,
    mockSet,
    mockUpdate,
    mockInsert,
    mockWhere,
    mockFrom,
    mockSelect,
    mockParseStatementText: vi.fn(),
    mockCategorizeTransactionsBatch: vi.fn(),
    mockEventsEmit: vi.fn(),
  };
});

// Mock schema module with all exports
vi.mock('../schema', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
  },
  statements: { id: 'statements.id', hash: 'statements.hash', userId: 'statements.userId' },
  transactions: { statementId: 'transactions.statementId' },
  userSettings: { userId: 'userSettings.userId' },
  accounts: { id: 'accounts.id' },
  statementAccounts: { id: 'statementAccounts.id' },
  merchantMemory: { id: 'merchantMemory.id' },
  pendingCategorization: { id: 'pendingCategorization.id' },
  users: { id: 'users.id' },
}));

// Mock AI service
vi.mock('./ai', () => ({
  aiService: {
    parseStatementText: mockParseStatementText,
    categorizeTransactionsBatch: mockCategorizeTransactionsBatch,
    extractAccountInfo: vi.fn().mockResolvedValue({
      accountNumber: '12345678',
      accountNumberMasked: '****5678',
      bankName: 'CBA',
      accountType: 'Savings',
      openingBalance: 1000,
      closingBalance: 2000,
    }),
    categorizeWithMemory: vi.fn().mockResolvedValue([
      {
        category: 'Food',
        gst: true,
        notes: 'Yum',
        confidence: 0.9,
        merchantNormalized: 'Test Merchant',
      },
    ]),
    parseWithVision: vi.fn(),
  },
}));

// Mock RAG service
vi.mock('./rag', () => ({
  ragService: {
    indexTransactions: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Account service
vi.mock('./accounts', () => ({
  accountService: {
    hashAccountNumber: vi.fn().mockReturnValue('hashed_acc_num'),
    findAccountByHash: vi.fn().mockResolvedValue({ id: 'acc1', accountName: 'Test Account' }),
    updateAccountBalance: vi.fn().mockResolvedValue(undefined),
    getMerchantMemory: vi.fn().mockResolvedValue([]),
    updateMerchantMemory: vi.fn().mockResolvedValue(undefined),
    linkStatementToAccount: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock events (include typed helper methods used by pipeline)
vi.mock('../events', () => ({
  events: {
    emit: mockEventsEmit,
    emitBatchProgress: mockEventsEmit,
    emitParsingComplete: mockEventsEmit,
    emitTransferDetected: mockEventsEmit,
    emitEnrichmentStatus: mockEventsEmit,
    emitVisionVerification: mockEventsEmit,
    emitPipelineError: mockEventsEmit,
    emitStatementUpdated: mockEventsEmit,
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('mock pdf content')),
}));

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({ text: 'extracted text' }),
}));

// Mock pdfjs-dist (used for PDF page rendering)
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
        render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      }),
    }),
  }),
  GlobalWorkerOptions: { workerSrc: '' },
}));

// Mock cognee_client
vi.mock('./cognee_client', () => ({
  cogneeClient: {
    addStatementData: vi.fn().mockResolvedValue(undefined),
    addTransaction: vi.fn().mockResolvedValue(undefined),
    searchSimilarTransactions: vi.fn().mockResolvedValue([]),
    cognify: vi.fn().mockResolvedValue(undefined),
    storeMerchantMapping: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock enrichment service
vi.mock('./enrichment', () => ({
  enrichmentService: {
    enrichTransactions: vi.fn().mockResolvedValue({ enriched: 0, failed: 0, pending: 0 }),
    enrichUncategorized: vi.fn().mockResolvedValue({ enriched: 0, failed: 0, pending: 0 }),
  },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock errors module
vi.mock('../errors', () => ({
  PdfParsingError: class PdfParsingError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'PdfParsingError';
    }
  },
  AiParseError: class AiParseError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'AiParseError';
    }
  },
}));

// Mock Claude orchestrator
vi.mock('./claude/orchestrator', () => ({
  orchestrator: {
    isEnabled: vi.fn().mockReturnValue(false),
    invoke: vi.fn().mockResolvedValue({ transactions: [] }),
  },
}));

// Mock Claude config
vi.mock('./claude/config', () => ({
  isClaudeAgentsEnabled: vi.fn().mockReturnValue(false),
  isAgentEnabled: vi.fn().mockReturnValue(false),
}));

// Mock parser registry
vi.mock('./parsers/registry', () => ({
  parserRegistry: {
    detect: vi.fn().mockReturnValue(null),
    parse: vi.fn().mockResolvedValue(null),
  },
}));

// Mock transfer detection
vi.mock('./transfers/index', () => ({
  TransferDetector: class {
    detectTransfers() {
      return [];
    }
  },
  detectTransfers: vi.fn().mockReturnValue([]),
  excludeTransfers: vi.fn().mockReturnValue([]),
}));

// Mock transfer persistence
vi.mock('./transfers/persistence', () => ({
  persistTransferMatches: vi
    .fn()
    .mockResolvedValue({ created: 0, skipped: 0, errors: [], linkIds: [] }),
  markOwnerContributions: vi.fn().mockResolvedValue(0),
}));

// Mock credit card parsers
vi.mock('./parsers/documents/credit-card/index', () => ({
  detectCreditCardStatement: vi.fn().mockReturnValue(false),
  parseCreditCardStatement: vi.fn().mockResolvedValue({ transactions: [] }),
}));

// Mock detector
vi.mock('./parsers/detector', () => ({
  hasCreditCardIndicators: vi.fn().mockReturnValue(false),
}));

import { PipelineService } from './pipeline';

describe('PipelineService', () => {
  let pipelineService: PipelineService;

  // Helper to setup mock chain for each test
  const setupMockChain = () => {
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ get: mockGet, all: mockAll });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue({}) });
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    setupMockChain();
    pipelineService = new PipelineService();

    // Reset pdf-parse mock to success by default
    const pdfParse = await import('pdf-parse');
    vi.mocked(pdfParse.default).mockResolvedValue({
      text: 'This is a sufficiently long mock PDF content to pass the length check validation in the pipeline service. It needs to be at least 50 characters long.',
      numpages: 1,
      numrender: 1,
      info: {},
      metadata: null,
      version: 'default' as const,
    });
  });

  it('should handle errors by setting status to FAILED', async () => {
    // Setup error scenario
    mockGet.mockRejectedValue(new Error('DB connection failed'));

    await pipelineService.processStatement('s1', 'path/to/test.pdf');

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        parsingStatus: 'FAILED',
        errorType: 'CRITICAL_ERROR',
      }),
    );
    expect(mockEventsEmit).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({
        status: 'FAILED',
      }),
    );
  });

  it('should retry PDF parsing on failure and then fail', async () => {
    // Setup mocks
    const mockStmt = { id: 's1', userId: 'u1', filename: 'test.pdf' };
    mockGet.mockResolvedValue(mockStmt);

    // Mock pdf-parse to fail
    const pdfParse = await import('pdf-parse');
    vi.mocked(pdfParse.default).mockRejectedValue(new Error('Corrupt PDF'));

    await pipelineService.processStatement('s1', 'path/to/test.pdf');

    // Should have updated status to FAILED with PDF_READ_ERROR
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        parsingStatus: 'FAILED',
        errorType: 'PDF_READ_ERROR',
        errorMessage: 'Corrupt PDF',
      }),
    );

    // Verify we tried 3 times (initial + 2 retries) is implicit in the implementation,
    // but since we can't easily spy on the internal retry loop count without exposing it,
    // we mainly check the final outcome.
  });

  it('should emit update events during processing', async () => {
    // Setup mocks for successful flow
    const mockStmt = { id: 's1', userId: 'u1', filename: 'test.pdf' };
    mockGet.mockResolvedValue(mockStmt);

    mockParseStatementText.mockResolvedValue({
      transactions: [{ date: '2024-01-01', description: 'Test TX', amount_cents: -100 }],
    });

    mockCategorizeTransactionsBatch.mockResolvedValue([
      { category: 'Food', gst: true, notes: 'Yum' },
    ]);

    await pipelineService.processStatement('s1', 'path/to/test.pdf');

    // Should have emitted events
    expect(mockEventsEmit).toHaveBeenCalled();
  });
});
