/**
 * Barrel export for all agent output Zod schemas and the SchemaRegistry.
 */

// Categorizer
export {
  CategorizerResultSchema,
  CategorizerOutputSchema,
  type CategorizerOutputValidated,
} from './categorizer-output.js';

// Budget Analyzer
export {
  BudgetInsightSchema,
  CategoryBreakdownSchema,
  RecurringExpenseSchema,
  ProjectionSchema,
  BudgetAnalyzerOutputSchema,
  type BudgetAnalyzerOutputValidated,
} from './budget-output.js';

// GST Calculator
export {
  BASLabelsSchema,
  TransactionBreakdownSchema,
  GSTCalculatorOutputSchema,
  type GSTCalculatorOutputValidated,
} from './gst-output.js';

// Tax Strategy
export {
  CurrentTaxPositionSchema,
  TaxStrategyItemSchema,
  TaxStrategyOutputSchema,
  type TaxStrategyOutputValidated,
} from './tax-strategy-output.js';

// Merchant Intelligence
export {
  MerchantResultSchema,
  NewMappingSchema,
  MerchantIntelligenceOutputSchema,
  type MerchantIntelligenceOutputValidated,
} from './merchant-output.js';

// Reconciler
export {
  DuplicateSchema,
  BalanceContinuitySchema,
  TransferMatchSchema,
  UnmatchedTransactionSchema,
  RunningBalanceErrorSchema,
  ReconcilerOutputSchema,
  type ReconcilerOutputValidated,
} from './reconciler-output.js';

// Statement Parser
export {
  BankIdSchema,
  AccountTypeSchema,
  AccountInfoSchema,
  ParsedTransactionSchema,
  StatementParserOutputSchema,
  type StatementParserOutputValidated,
} from './parser-output.js';

// Financial Planner
export {
  SpendingAnalysisSchema,
  BudgetRecommendationSchema,
  WealthProjectionSchema,
  DebtStrategySchema,
  FinancialPlannerOutputSchema,
  type FinancialPlannerOutputValidated,
} from './planner-output.js';

// Registry
export { SchemaRegistry, schemaRegistry } from './schema-registry.js';
