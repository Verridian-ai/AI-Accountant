/**
 * Intent Router — Types & Constants
 *
 * Exported interfaces and keyword rules for intent classification.
 */

import type { AgentType } from './types.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface IntentClassification {
  intent:
    | 'agent_invocation'
    | 'direct_question'
    | 'transaction_edit'
    | 'batch_operation'
    | 'multi_agent';
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  confidence: number;
  reasoning: string;
  extractedParams: Record<string, unknown>;
}

export const INTENT_CONFIDENCE_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Keyword pre-filter definitions
// ---------------------------------------------------------------------------

export interface KeywordRule {
  patterns: RegExp[];
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  intent: IntentClassification['intent'];
  confidence: number;
}

/**
 * Static fallback agent list — used when orchestrator is not wired in.
 */
export const STATIC_AGENT_LIST = [
  '- statement_parser: Parse PDF bank statements into structured transactions',
  '- transaction_categorizer: Categorize transactions into accounting categories with GST',
  '- gst_calculator: Calculate BAS, GST, PAYG withholding per ATO rules',
  '- merchant_intelligence: Resolve merchant names, lookup ABN/GST registration',
  '- tax_strategy: ATO-compliant tax minimization strategies',
  '- personal_tax_claims: Identify personal tax deduction claims (WFH, vehicle, etc.)',
  '- financial_planner: Financial planning, debt strategies, wealth projections',
  '- budget_analyzer: Spending analysis, budget tracking, anomaly detection',
  '- account_reconciler: Statement-to-statement balance reconciliation',
  '- cross_account_tracer: Inter-account fund flow tracing',
  '- payroll_agent: Wage detection, PAYG calculation, ATO tax tables',
  '- inventory_agent: Stock tracking, COGS calculation, reorder suggestions',
  '- bank_reconciler_agent: Bank-to-ledger matching with confidence scoring',
  '- ocr_processing: Extract data from scanned documents using Vision API',
  '- payment_matching: Match OCR documents to bank transactions',
  '- asset_management: ATO Div 40 depreciation, instant write-off calculation',
  '- multi_entity: Multi-entity consolidation, intercompany transactions',
  '- financial_reporting: AASB-compliant P&L, balance sheet, cash flow, trial balance',
  '- budgeting: Budget creation from history, variance analysis, forecasting',
  '- forecasting: Cash flow forecasting, seasonal patterns, scenario analysis',
  '- compliance_monitoring: ATO deadline tracking, risk detection, obligation checks',
].join('\n');

export const KEYWORD_RULES: KeywordRule[] = [
  {
    patterns: [/\bbas\b/i, /\bgst\b/i],
    primaryAgent: 'gst_calculator',
    secondaryAgents: ['transaction_categorizer'],
    intent: 'agent_invocation',
    confidence: 0.92,
  },
  {
    patterns: [/\bpayslip/i, /\bpayroll/i, /\bwages?\b/i],
    primaryAgent: 'payroll_agent',
    secondaryAgents: [],
    intent: 'agent_invocation',
    confidence: 0.9,
  },
  {
    patterns: [/\bdepreciat/i, /\basset\s+write/i],
    primaryAgent: 'asset_management',
    secondaryAgents: [],
    intent: 'agent_invocation',
    confidence: 0.9,
  },
  {
    patterns: [
      /\bp\s*&\s*l\b/i,
      /\bprofit\s+and\s+loss/i,
      /\bbalance\s+sheet/i,
      /\btrial\s+balance/i,
    ],
    primaryAgent: 'financial_reporting',
    secondaryAgents: [],
    intent: 'agent_invocation',
    confidence: 0.92,
  },
  {
    patterns: [/\bforecast/i, /\bcash\s+flow\s+predict/i],
    primaryAgent: 'forecasting',
    secondaryAgents: [],
    intent: 'agent_invocation',
    confidence: 0.88,
  },
  {
    patterns: [/\bcategori[sz]e/i],
    primaryAgent: 'transaction_categorizer',
    secondaryAgents: ['merchant_intelligence'],
    intent: 'agent_invocation',
    confidence: 0.88,
  },
  {
    patterns: [
      /\bmortgage/i,
      /\bhome\s+loan/i,
      /\binterest\s+rate/i,
      /\bcompare\s+(rate|product|bank)/i,
      /\brefinanc/i,
      /\bborrowing\s+capacity/i,
      /\bcdr\b/i,
      /\bopen\s+banking/i,
      /\bbank(ing)?\s+product/i,
      /\bsavings\s+account/i,
      /\bterm\s+deposit/i,
      /\bcredit\s+card\s+rate/i,
    ],
    primaryAgent: 'cdr_product',
    secondaryAgents: [],
    intent: 'agent_invocation',
    confidence: 0.9,
  },
];
