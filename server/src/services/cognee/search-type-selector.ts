/**
 * F6: All 14 Search Types — Smart Selection
 *
 * Maps ALL 14 Cognee search types to specific use cases in GoldLedger.
 * Provides intelligent search type selection based on query analysis.
 *
 * Based on docs/COGNEE_INTEGRATION_PLAN.md Section 8.
 */

import type { CogneeSearchType } from './types.js';

/**
 * Context for search type selection
 */
export interface SearchTypeContext {
  /** Agent making the request (if applicable) */
  agentType?:
    | 'transaction_categorizer'
    | 'gst_calculator'
    | 'tax_strategy'
    | 'personal_tax_claims'
    | 'merchant_intelligence'
    | 'account_reconciler'
    | 'cross_account_tracer'
    | 'financial_reporting'
    | 'budgeting'
    | 'forecasting'
    | 'compliance_monitoring'
    | 'market_intelligence'
    | 'cdr_product'
    | 'chat';

  /** Dataset being searched */
  dataset?: string;

  /** Whether user is an admin/power user */
  isAdmin?: boolean;
}

/**
 * Smart search type selection based on query analysis
 *
 * Analyzes query text and context to select the most appropriate Cognee search type
 * from all 14 available types.
 *
 * @param query - User's search query
 * @param context - Additional context about the search
 * @returns The most appropriate CogneeSearchType
 */
export function selectSearchType(
  query: string,
  context: SearchTypeContext = {},
): CogneeSearchType {
  const q = query.toLowerCase();

  // GRAPH_COMPLETION_COT — Complex tax/GST questions requiring step-by-step reasoning
  if (
    /\b(can i claim|deduct|gst|bas|tax|ato|ruling|combination)\b/i.test(query) &&
    /\b(and|also|both|as well as|plus)\b/i.test(query)
  ) {
    return 'GRAPH_COMPLETION_COT';
  }

  // RAG_COMPLETION — Document/ruling references
  if (
    /\b(ruling|regulation|section|division|tr \d+|gstr|ato determination)\b/i.test(
      query,
    )
  ) {
    return 'RAG_COMPLETION';
  }

  // CHUNKS_LEXICAL — Exact keyword matching (merchant names, ABN, BSB)
  if (/\b(merchant|vendor|supplier|abn|bsb|account number)\b/i.test(query)) {
    return 'CHUNKS_LEXICAL';
  }

  // SUMMARIES — Period summaries
  if (/\b(summary|overview|report|quarter|period|month|year)\b/i.test(query)) {
    return 'SUMMARIES';
  }

  // CHUNKS — Transaction similarity
  if (/\b(similar|like|transactions like|find transactions)\b/i.test(query)) {
    return 'CHUNKS';
  }

  // GRAPH_COMPLETION_CONTEXT_EXTENSION — Exploration queries
  if (/\b(everything|all|related|connected|show me|trace|follow)\b/i.test(query)) {
    return 'GRAPH_COMPLETION_CONTEXT_EXTENSION';
  }

  // GRAPH_SUMMARY_COMPLETION — Dashboard widgets, quick overviews
  if (/\b(quick|brief|summarize|dashboard|widget|at a glance)\b/i.test(query)) {
    return 'GRAPH_SUMMARY_COMPLETION';
  }

  // NATURAL_LANGUAGE — Ad-hoc graph queries (power users)
  if (
    context.isAdmin &&
    /\b(all|show|list|find|get)\b.*\b(in|with|where|having)\b/i.test(query)
  ) {
    return 'NATURAL_LANGUAGE';
  }

  // CYPHER — Direct graph queries (admin only)
  if (context.isAdmin && /^(match|create|merge|return|where)\b/i.test(q)) {
    return 'CYPHER';
  }

  // CODING_RULES — Memify-derived financial domain rules
  if (/\b(rule|policy|guideline|standard|procedure)\b/i.test(query)) {
    return 'CODING_RULES';
  }

  // FEELING_LUCKY — Ambiguous queries (let Cognee auto-select)
  if (query.split(' ').length <= 3 && !/\b(can|how|why|what|when)\b/i.test(q)) {
    return 'FEELING_LUCKY';
  }

  // GRAPH_COMPLETION — Default for reasoning/chat queries
  return 'GRAPH_COMPLETION';
}

/**
 * Agent-specific search type overrides
 *
 * Some agents have preferred search types based on their domain.
 */
export function getAgentPreferredSearchType(
  agentType: SearchTypeContext['agentType'],
  query: string,
): CogneeSearchType | null {
  switch (agentType) {
    case 'transaction_categorizer':
      // Categorizer uses CHUNKS for similarity, CHUNKS_LEXICAL for merchant lookup
      return query.toLowerCase().includes('merchant')
        ? 'CHUNKS_LEXICAL'
        : 'CHUNKS';

    case 'gst_calculator':
    case 'tax_strategy':
    case 'personal_tax_claims':
      // Tax agents use COT for complex reasoning, RAG for rulings
      return query.toLowerCase().includes('ruling')
        ? 'RAG_COMPLETION'
        : 'GRAPH_COMPLETION_COT';

    case 'merchant_intelligence':
      // Merchant intel prefers lexical search for exact names
      return 'CHUNKS_LEXICAL';

    case 'cross_account_tracer':
      // Tracer uses context extension for multi-hop exploration
      return 'GRAPH_COMPLETION_CONTEXT_EXTENSION';

    case 'financial_reporting':
    case 'budgeting':
      // Reporting agents use summaries
      return 'SUMMARIES';

    case 'forecasting':
    case 'compliance_monitoring':
      // Analytics agents use graph completion
      return 'GRAPH_COMPLETION';

    default:
      return null; // No override, use selectSearchType
  }
}

/**
 * All 14 search types with descriptions
 *
 * Complete mapping from docs/COGNEE_INTEGRATION_PLAN.md Section 8.1
 */
export const ALL_SEARCH_TYPES: Record<CogneeSearchType, string> = {
  GRAPH_COMPLETION:
    'Multi-hop reasoning: "Why is my spending increasing?" (default for chat)',
  GRAPH_COMPLETION_COT:
    'Chain-of-thought for complex tax queries: "Can I claim home office AND car expenses?"',
  GRAPH_COMPLETION_CONTEXT_EXTENSION:
    'Multi-hop exploration: "Show me everything related to AGL Energy"',
  RAG_COMPLETION:
    'Document-grounded answers: "What does ATO ruling TR 2024/3 say about..."',
  CHUNKS: 'Fast transaction similarity: "Find transactions similar to this one"',
  CHUNKS_LEXICAL: 'Exact keyword matching: merchant name lookup, ABN search',
  SUMMARIES: 'Period-level overviews: "Summarize my Q3 spending"',
  GRAPH_SUMMARY_COMPLETION:
    'Condensed graph answers for dashboard widgets (quick overviews)',
  NATURAL_LANGUAGE:
    'Ad-hoc graph queries from chat: "Show me all merchants in Office Supplies category"',
  CYPHER:
    'Direct graph queries for admin/debug: custom Cypher from admin UI',
  CODE: 'Codebase knowledge: our own code indexed for dev assistance',
  FEELING_LUCKY:
    'Auto-select best search mode when query type is ambiguous',
  FEEDBACK: 'Store user feedback on search quality for future tuning',
  CODING_RULES: 'Retrieved from memify enrichment — financial domain rules',
};

/**
 * Dataset-specific search type recommendations
 */
export function getDatasetPreferredSearchType(
  dataset: string,
): CogneeSearchType | null {
  // GST/tax datasets prefer RAG for ruling lookup
  if (/\b(gst_rules|ato_rulings|tax_tables|deduction_patterns)\b/.test(dataset)) {
    return 'RAG_COMPLETION';
  }

  // Transaction datasets prefer CHUNKS for similarity
  if (/\b(bank_transactions|financial_reports)\b/.test(dataset)) {
    return 'CHUNKS';
  }

  // Merchant datasets prefer CHUNKS_LEXICAL for exact matching
  if (/\b(merchant_data|merchant_mappings|supplier_profiles)\b/.test(dataset)) {
    return 'CHUNKS_LEXICAL';
  }

  // Pattern/intelligence datasets prefer GRAPH_COMPLETION
  if (
    /\b(forecast_patterns|anomaly_history|compliance_rulings|temporal_patterns)\b/.test(
      dataset,
    )
  ) {
    return 'GRAPH_COMPLETION';
  }

  return null; // No dataset-specific override
}

/**
 * Comprehensive search type selection with context awareness
 *
 * Combines query analysis, agent preferences, and dataset preferences.
 */
export function selectSearchTypeWithContext(
  query: string,
  context: SearchTypeContext = {},
): CogneeSearchType {
  // Priority 1: Agent-specific override
  if (context.agentType) {
    const agentPreferred = getAgentPreferredSearchType(context.agentType, query);
    if (agentPreferred) return agentPreferred;
  }

  // Priority 2: Dataset-specific recommendation
  if (context.dataset) {
    const datasetPreferred = getDatasetPreferredSearchType(context.dataset);
    if (datasetPreferred) return datasetPreferred;
  }

  // Priority 3: Query-based selection
  return selectSearchType(query, context);
}
