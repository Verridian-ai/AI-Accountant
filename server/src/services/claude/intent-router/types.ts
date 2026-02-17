/**
 * Intent Router Types — Intent classification types and keyword rule definitions.
 */

import type { AgentType } from '../types.js';

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
