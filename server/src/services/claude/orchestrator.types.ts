/**
 * Claude Agent Framework — Orchestrator Type Maps
 *
 * Union maps of all agent I/O types for typed invoke() dispatch.
 */

import type {
  StatementParserInput,
  StatementParserOutput,
  CategorizerInput,
  CategorizerOutput,
  GSTCalculatorInput,
  GSTCalculatorOutput,
  ReconcilerInput,
  ReconcilerOutput,
  BudgetAnalyzerInput,
  BudgetAnalyzerOutput,
  CrossAccountTracerInput,
  CrossAccountTracerOutput,
  MerchantIntelligenceInput,
  MerchantIntelligenceOutput,
  TaxStrategyInput,
  TaxStrategyOutput,
  FinancialPlannerInput,
  FinancialPlannerOutput,
  MarketIntelInput,
  MarketIntelOutput,
  TenantRoutingInput,
  TenantRoutingOutput,
  InvoiceAgentInput,
  InvoiceAgentOutput,
  AccountsPayableInput,
  AccountsPayableOutput,
} from './types.js';

// Union of all agent I/O types
export type AgentInputMap = {
  statement_parser: StatementParserInput;
  transaction_categorizer: CategorizerInput;
  gst_calculator: GSTCalculatorInput;
  account_reconciler: ReconcilerInput;
  budget_analyzer: BudgetAnalyzerInput;
  cross_account_tracer: CrossAccountTracerInput;
  merchant_intelligence: MerchantIntelligenceInput;
  tax_strategy: TaxStrategyInput;
  financial_planner: FinancialPlannerInput;
  market_intelligence: MarketIntelInput;
  tenant_routing: TenantRoutingInput;
  invoice_agent: InvoiceAgentInput;
  accounts_payable_agent: AccountsPayableInput;
  [key: string]: unknown;
};

export type AgentOutputMap = {
  statement_parser: StatementParserOutput;
  transaction_categorizer: CategorizerOutput;
  gst_calculator: GSTCalculatorOutput;
  account_reconciler: ReconcilerOutput;
  budget_analyzer: BudgetAnalyzerOutput;
  cross_account_tracer: CrossAccountTracerOutput;
  merchant_intelligence: MerchantIntelligenceOutput;
  tax_strategy: TaxStrategyOutput;
  financial_planner: FinancialPlannerOutput;
  market_intelligence: MarketIntelOutput;
  tenant_routing: TenantRoutingOutput;
  invoice_agent: InvoiceAgentOutput;
  accounts_payable_agent: AccountsPayableOutput;
  [key: string]: unknown;
};
