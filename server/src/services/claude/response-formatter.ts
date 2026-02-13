/**
 * ResponseFormatter — Transforms raw agent output into structured ChatResponse objects.
 *
 * Critical contract: The /api/chat endpoint MUST always return { answer: string }.
 * formatError() guarantees this even when agents fail.
 */

import type { AgentType } from './types.js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ChatResponse {
  answer: string;
  agentType?: string;
  intentClassification?: { intent: string; confidence: number };
  actions?: Array<{ id: string; type: string; description: string; data: unknown }>;
  data?: unknown;
  suggestedFollowups?: string[];
}

/**
 * Result from dispatching a single agent.
 * Defined inline because agent-dispatcher.ts may not exist yet.
 */
export interface AgentDispatchResult {
  success: boolean;
  agentType: string;
  result: unknown;
  error?: string;
  duration: number;
}

/**
 * Result from a multi-agent pipeline execution.
 */
export interface PipelineResult {
  results: AgentDispatchResult[];
  finalResult: unknown;
  totalDuration: number;
}

// ---------------------------------------------------------------------------
// ResponseFormatter
// ---------------------------------------------------------------------------

export class ResponseFormatter {
  /**
   * Format a single agent dispatch result into a ChatResponse.
   */
  formatSingle(
    agentType: AgentType,
    result: AgentDispatchResult,
    intent?: { intent: string; confidence: number },
  ): ChatResponse {
    if (!result.success) {
      return this.formatError(result.error ?? 'Agent returned an unsuccessful result');
    }

    const answer = this.extractAnswer(agentType, result.result);
    const followups = this.generateFollowups(agentType);

    return {
      answer,
      agentType,
      ...(intent ? { intentClassification: intent } : {}),
      ...(result.result != null && typeof result.result === 'object'
        ? { data: result.result }
        : {}),
      suggestedFollowups: followups,
    };
  }

  /**
   * Format a pipeline result (multi-agent) into a single ChatResponse.
   * Uses the final agent's output as the primary answer and appends
   * intermediate results as supplementary data.
   */
  formatPipeline(
    pipeline: PipelineResult,
    intent?: { intent: string; confidence: number },
  ): ChatResponse {
    const { results, finalResult } = pipeline;

    if (results.length === 0) {
      return this.formatError('No agent results were produced');
    }

    // Use the last successful result as the primary agent
    const lastSuccessful = [...results].reverse().find((r) => r.success);
    if (!lastSuccessful) {
      const errors = results.map((r) => r.error).filter(Boolean).join('; ');
      return this.formatError(errors || 'All agents in the pipeline failed');
    }

    const primaryAgentType = lastSuccessful.agentType as AgentType;
    const answer = this.extractAnswer(primaryAgentType, finalResult ?? lastSuccessful.result);
    const followups = this.generateFollowups(primaryAgentType);

    // Build supplementary data from intermediate results
    const intermediateResults = results
      .filter((r) => r !== lastSuccessful && r.success)
      .map((r) => ({
        agentType: r.agentType,
        result: r.result,
        duration: r.duration,
      }));

    return {
      answer,
      agentType: primaryAgentType,
      ...(intent ? { intentClassification: intent } : {}),
      data: {
        primaryResult: lastSuccessful.result,
        ...(intermediateResults.length > 0 ? { intermediateResults } : {}),
        totalDuration: pipeline.totalDuration,
      },
      suggestedFollowups: followups,
    };
  }

  /**
   * Format an error into a ChatResponse.
   * CRITICAL: Always returns { answer: string }, NEVER { error: string }.
   */
  formatError(error: string | Error): ChatResponse {
    const message = error instanceof Error ? error.message : error;
    return {
      answer: `I encountered an issue processing your request: ${message}. Could you try rephrasing your question?`,
    };
  }

  /**
   * Format monetary values consistently (AUD, 2 decimal places).
   * Accepts values in cents.
   */
  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(cents / 100);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Generate contextual follow-up suggestions based on agent type.
   */
  private generateFollowups(agentType: AgentType): string[] {
    const followupMap: Partial<Record<AgentType, string[]>> = {
      gst_calculator: [
        'Show me the BAS breakdown by label',
        'What are my input tax credits this quarter?',
        'Compare this quarter to last quarter',
      ],
      budget_analyzer: [
        'What are my top spending categories?',
        'Show recurring payments',
        "Forecast next month's cash flow",
      ],
      transaction_categorizer: [
        'Show uncategorized transactions',
        'What category has the most transactions?',
        'Review GST classifications',
      ],
      tax_strategy: [
        'What deductions am I missing?',
        'Calculate my tax for this year',
        'Show depreciation schedule',
      ],
      financial_reporting: [
        'Generate a balance sheet',
        'Show cash flow statement',
        'Compare to last period',
      ],
      payroll_agent: [
        'Show PAYG withholding summary',
        'What are total wage costs this month?',
        'Check super guarantee obligations',
      ],
      statement_parser: [
        'Show me the parsed transactions',
        'Are there any parsing warnings?',
        'Upload another statement',
      ],
      account_reconciler: [
        'Show any duplicate transactions',
        'Check balance continuity',
        'Find unmatched transfers',
      ],
      cross_account_tracer: [
        'Show net flows between accounts',
        'Are there any multi-hop transfers?',
        'Generate a flow diagram',
      ],
      merchant_intelligence: [
        'Which merchants are GST registered?',
        'Show merchant spending breakdown',
        'Find unknown merchant names',
      ],
      personal_tax_claims: [
        'What work-from-home claims can I make?',
        'Show my motor vehicle deductions',
        'Which claims need receipts?',
      ],
      financial_planner: [
        'What is my current savings rate?',
        'Show my wealth projection',
        'How should I prioritise debt repayment?',
      ],
      inventory_agent: [
        'Which items need reordering?',
        'Show inventory valuation',
        'Calculate cost of goods sold',
      ],
      bank_reconciler_agent: [
        'Show unmatched bank transactions',
        'What are the discrepancies?',
        'Suggest reconciliation rules',
      ],
      asset_management: [
        'Show my depreciation schedule',
        'Which assets qualify for instant write-off?',
        'Compare diminishing value vs prime cost',
      ],
      multi_entity: [
        'Show inter-entity transactions',
        'Generate consolidated report',
        'Check elimination entries',
      ],
      ocr_processing: [
        'Extract line items from this document',
        'Validate the extracted data',
        'Upload another document',
      ],
      payment_matching: [
        'Show suggested payment matches',
        'Review unmatched payments',
        'What matching rules are active?',
      ],
      forecasting: [
        'Forecast next 3 months cash flow',
        'Show seasonal spending patterns',
        'Flag any spending anomalies',
      ],
      compliance_monitoring: [
        'What are my upcoming obligations?',
        'Show compliance risks',
        'Check BAS lodgement status',
      ],
      budgeting: [
        'Show budget vs actual variance',
        'Create a new budget',
        'Suggest budget adjustments',
      ],
    };

    return followupMap[agentType] ?? [
      'Tell me more about this',
      'Show related transactions',
      'Export this data',
    ];
  }

  /**
   * Extract a human-readable answer from raw agent output.
   * Tries common response patterns before falling back to a generic message.
   */
  private extractAnswer(agentType: AgentType, rawResult: unknown): string {
    if (typeof rawResult === 'string') return rawResult;

    if (rawResult == null) {
      return `Analysis complete. The ${agentType} agent processed your request successfully.`;
    }

    const result = rawResult as Record<string, unknown>;

    // Try common response fields in priority order
    if (typeof result.summary === 'string' && result.summary.length > 0) return result.summary;
    if (typeof result.answer === 'string' && result.answer.length > 0) return result.answer;
    if (typeof result.analysis === 'string' && result.analysis.length > 0) return result.analysis;
    if (typeof result.message === 'string' && result.message.length > 0) return result.message;

    // Fallback
    return `Analysis complete. The ${agentType} agent processed your request successfully.`;
  }
}
