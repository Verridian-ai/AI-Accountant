/**
 * Re-export all shared types from @goldledger/shared for backward compatibility.
 * New code should import directly from '@goldledger/shared'.
 */

// User types
export type { UserSettings } from '@goldledger/shared';

// Transaction types
export type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionStats,
  PendingCategorization,
  MerchantMemory,
  TransferLink,
} from '@goldledger/shared';

// Statement types
export type {
  Statement,
  StatementGapAnalysis,
  BatchFileStatus,
  BatchUploadResponse,
  BatchJobStatus,
} from '@goldledger/shared';

// Account types
export type {
  Account,
  CreateAccountRequest,
  BalanceHistoryEntry,
  ReconciliationAlert,
  CreditCardAnalytics,
  DebtStrategy,
  DebtRecommendations,
} from '@goldledger/shared';

// Tax types
export type {
  BASQuarter,
  BASCalculation,
  TaxBracket,
  Deduction,
  CGTAsset,
  CGTEvent,
  DepreciableAsset,
  TaxSummary,
  TaxCalculationResult,
} from '@goldledger/shared';

// AP types
export type {
  Supplier,
  BillLineItem,
  Bill,
  POLineItem,
  PurchaseOrder,
  PaymentRun,
  APAgingBucket,
  APAgingReport,
} from '@goldledger/shared';

// Report types
export type {
  CategoryGroup,
  ProfitAndLossReport,
  ConsolidatedReport,
  SupportedBank,
} from '@goldledger/shared';

// Agent types
export type { MutationEvent, AuditEntry, StreamEvent } from '@goldledger/shared';

// Common types
export type { OCRDocument, OCRLineItem } from '@goldledger/shared';

// Placeholder types
export type {
  AssetRegisterResponse,
  AutoMatchResult,
  BalanceSheetReport,
  BatchDepreciationResult,
  BorrowingCapacityResult,
  Budget,
  BudgetLine,
  BudgetVariance,
  CarFinanceComparison,
  CashFlowReport,
  ConsolidationDetailResponse,
  ConsolidationSnapshotData,
  DepreciationScheduleResponse,
  DetectedEquityEvent,
  EntityData,
  EntityHierarchyResponse,
  EntitySettingData,
  EntityWithDetails,
  EquitySummary,
  FixedAssetData,
  ForecastPeriod,
  ForecastScenario,
  HomeLoanResult,
  InterEntityTransactionData,
  KPIMetric,
  MatchCandidate,
  MatchStats,
  PaymentMatchRule,
  PeriodComparisonReport,
  PeriodComparisonRow,
  PersonalLoanResult,
  ProjectionResult,
  RecurringBill,
  RefinanceResult,
  RepaymentFrequency,
  TaxStrategyRecord,
  TrialBalanceEntry,
  TrialBalanceReport,
  VarianceSummary,
  WealthProjectionResult,
  TaxReturnResult,
} from '@goldledger/shared';
