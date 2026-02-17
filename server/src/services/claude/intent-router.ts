/**
 * Intent Router — Classifies user chat queries into structured intents
 * and routes to the appropriate agent(s).
 *
 * Uses a two-tier approach:
 * 1. Keyword pre-filter for high-confidence patterns (bypasses LLM)
 * 2. Claude Haiku for ambiguous classification (~100ms, ~$0.001/call)
 *
 * Agent discovery is dynamic: reads from orchestrator registry at runtime,
 * falling back to a static list for testing / backward compatibility.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getClient } from './client.js';
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

interface KeywordRule {
  patterns: RegExp[];
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  intent: IntentClassification['intent'];
  confidence: number;
}

const KEYWORD_RULES: KeywordRule[] = [
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

// ---------------------------------------------------------------------------
// IntentRouter
// ---------------------------------------------------------------------------

export class IntentRouter {
  private client: Anthropic;
  private orchestrator: unknown;

  constructor(orchestrator?: unknown) {
    this.client = getClient();
    this.orchestrator = orchestrator ?? null;
  }

  /**
   * Build the agent list portion of the system prompt dynamically from the
   * orchestrator's registry. Falls back to a static list if the orchestrator
   * is unavailable (e.g., during testing).
   */
  private buildAgentListPrompt(): string {
    const orch = this.orchestrator as Record<string, unknown> | undefined;
    if (orch && typeof orch.getRegisteredAgents === 'function') {
      const agents: Array<{ type: string; description: string }> =
        (orch.getRegisteredAgents as () => Array<{ type: string; description: string }>)();
      return agents.map((a) => `- ${a.type}: ${a.description}`).join('\n');
    }
    return this.getStaticAgentList();
  }

  /**
   * Static fallback agent list — only used when orchestrator is not wired in.
   */
  private getStaticAgentList(): string {
    return [
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
  }

  /**
   * Classify a user query into a structured intent.
   *
   * 1. Tries keyword pre-filter first (instant, no API call)
   * 2. Falls back to Claude Haiku classification
   * 3. Defaults to budget_analyzer with low confidence on failure
   */
  async classify(
    query: string,
    context?: {
      recentTransactions?: number;
      accountIds?: string[];
      hasUnprocessedStatements?: boolean;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
  ): Promise<IntentClassification> {
    // ---- Tier 1: Keyword pre-filter ----
    const keywordMatch = this.matchKeywords(query);
    if (keywordMatch) {
      return keywordMatch;
    }

    // ---- Tier 2: LLM classification ----
    try {
      return await this.classifyWithLLM(query, context);
    } catch (err) {
      console.warn('[IntentRouter] Classification failed, using fallback:', err);
      return this.fallbackClassification(query);
    }
  }

  /**
   * Attempt keyword-based classification. Returns null if no rule matches.
   */
  private matchKeywords(query: string): IntentClassification | null {
    for (const rule of KEYWORD_RULES) {
      if (rule.patterns.some((p) => p.test(query))) {
        return {
          intent: rule.intent,
          primaryAgent: rule.primaryAgent,
          secondaryAgents: rule.secondaryAgents,
          confidence: rule.confidence,
          reasoning: `Keyword pre-filter matched for ${rule.primaryAgent}`,
          extractedParams: {},
        };
      }
    }
    return null;
  }

  /**
   * Classify via Claude Haiku — fast structured-output classification.
   */
  private async classifyWithLLM(
    query: string,
    context?: {
      recentTransactions?: number;
      accountIds?: string[];
      hasUnprocessedStatements?: boolean;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
  ): Promise<IntentClassification> {
    const agentList = this.buildAgentListPrompt();

    const systemPrompt = `You are an intent classifier for the GoldLedger AI accounting platform.

Available agents and their capabilities:
${agentList}

Classify the user's query and respond with JSON only (no markdown fences, no explanation):
{
  "intent": "agent_invocation|direct_question|transaction_edit|batch_operation|multi_agent",
  "primaryAgent": "<agent_type>",
  "secondaryAgents": ["<agent_type>", ...],
  "confidence": 0.0-1.0,
  "reasoning": "<brief explanation>",
  "extractedParams": { <any extracted dates, amounts, categories, account names, etc.> }
}

Intent definitions:
- agent_invocation: Direct agent call with parameters (e.g., "Calculate BAS for Q2 2024-25")
- direct_question: Factual question answerable from DB/context (e.g., "How much did I spend on fuel?")
- transaction_edit: Single mutation request (e.g., "Recategorize this as Office Supplies")
- batch_operation: Bulk operation (e.g., "Categorize all uncategorized transactions")
- multi_agent: Multi-step workflow requiring multiple agents (e.g., "Prepare my BAS")

Rules:
- For general spending/analysis questions, use budget_analyzer
- For tax-related questions, prefer tax_strategy or personal_tax_claims
- secondaryAgents should be empty [] unless agents genuinely need to collaborate
- confidence should reflect how certain you are about the routing
- extractedParams should capture dates, amounts, categories, quarters, financial years, etc.`;

    const userContent = this.buildUserMessage(query, context);

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');

    if (!textBlock) {
      throw new Error('No text response from Haiku classifier');
    }

    const parsed = this.parseJsonResponse(textBlock.text);

    // Validate and enforce confidence threshold
    if (parsed.confidence < INTENT_CONFIDENCE_THRESHOLD) {
      return {
        ...parsed,
        primaryAgent: 'budget_analyzer',
        reasoning: `Low confidence (${parsed.confidence}) — falling back to budget_analyzer. Original: ${parsed.reasoning}`,
      };
    }

    return parsed;
  }

  /**
   * Build the user message with optional context.
   */
  private buildUserMessage(
    query: string,
    context?: {
      recentTransactions?: number;
      accountIds?: string[];
      hasUnprocessedStatements?: boolean;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
  ): string {
    let msg = `User query: "${query}"`;

    if (context) {
      const parts: string[] = [];
      if (context.recentTransactions !== undefined) {
        parts.push(`Recent transactions in DB: ${context.recentTransactions}`);
      }
      if (context.accountIds?.length) {
        parts.push(`Active account IDs: ${context.accountIds.join(', ')}`);
      }
      if (context.hasUnprocessedStatements) {
        parts.push('User has unprocessed statements pending');
      }
      if (context.conversationHistory?.length) {
        const recent = context.conversationHistory.slice(-4);
        parts.push(
          `Recent conversation:\n${recent.map((m) => `${m.role}: ${m.content}`).join('\n')}`,
        );
      }
      if (parts.length > 0) {
        msg += `\n\nContext:\n${parts.join('\n')}`;
      }
    }

    return msg;
  }

  /**
   * Parse JSON from the classifier response, stripping markdown fences if present.
   */
  private parseJsonResponse(text: string): IntentClassification {
    // Strip markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    const jsonStr = fenceMatch ? fenceMatch[1] : text;

    try {
      const raw = JSON.parse(jsonStr.trim());
      return this.validateClassification(raw);
    } catch {
      // Try to find a JSON object anywhere in the text
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          const raw = JSON.parse(objectMatch[0]);
          return this.validateClassification(raw);
        } catch {
          // fall through
        }
      }
      throw new Error(`Failed to parse classifier response: ${text.slice(0, 200)}`);
    }
  }

  /**
   * Validate and normalize raw parsed classification data.
   */
  private validateClassification(raw: Record<string, unknown>): IntentClassification {
    const validIntents = [
      'agent_invocation',
      'direct_question',
      'transaction_edit',
      'batch_operation',
      'multi_agent',
    ];
    const rawIntent = raw.intent as string;
    const intent = (validIntents.includes(rawIntent) ? rawIntent : 'direct_question') as IntentClassification['intent'];

    return {
      intent,
      primaryAgent: (raw.primaryAgent ?? 'budget_analyzer') as AgentType,
      secondaryAgents: Array.isArray(raw.secondaryAgents)
        ? raw.secondaryAgents.filter((a: unknown): a is AgentType => typeof a === 'string')
        : [],
      confidence:
        typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.5,
      reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : 'No reasoning provided',
      extractedParams:
        typeof raw.extractedParams === 'object' && raw.extractedParams !== null
          ? (raw.extractedParams as Record<string, unknown>)
          : {},
    };
  }

  /**
   * Fallback classification when all else fails.
   */
  private fallbackClassification(query: string): IntentClassification {
    return {
      intent: 'direct_question',
      primaryAgent: 'budget_analyzer',
      secondaryAgents: [],
      confidence: 0.3,
      reasoning: `Fallback: classification failed for query "${query.slice(0, 80)}"`,
      extractedParams: {},
    };
  }
}
