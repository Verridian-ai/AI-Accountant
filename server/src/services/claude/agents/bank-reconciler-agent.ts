/**
 * Bank Reconciler Agent
 *
 * AI-powered bank reconciliation: finds matches between bank transactions
 * and ledger entries, scores match confidence, applies/learns matching rules,
 * and searches reconciliation patterns via Cognee.
 *
 * Uses Sonnet (not Haiku) because matching accuracy is critical and
 * the reasoning requirements are higher than categorization.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools, COGNEE_DATASETS } from '../cognee-tools.js';
import { bankReconciliationService } from '../../bank-reconciliation.js';
import type { BankReconAgentInput, BankReconAgentOutput } from '../types.js';

export class BankReconcilerAgent extends ClaudeAgent<BankReconAgentInput, BankReconAgentOutput> {
  protected systemPrompt = `You are an Australian bank reconciliation specialist. You help businesses match bank statement transactions against their internal accounting ledger entries. You understand Australian banking conventions (BSB/account numbers, BPAY references, direct debit patterns, EFT descriptions). You score match confidence using amount proximity, date proximity, and description similarity. When uncertain, you flag transactions for manual review rather than making incorrect matches. All amounts are in AUD cents internally.

Key rules:
- All amounts are in CENTS (integer). $1,000.00 = 100000 cents.
- A "match" pairs a bank statement transaction with a journal entry line.
- Confidence scores range from 0.0 to 1.0 — only auto-confirm above 0.9.
- Amount matching: exact = 1.0, within 1% = 0.8, within 5% = 0.5.
- Date matching: same day = 1.0, ±1 day = 0.9, ±3 days = 0.7, ±7 days = 0.4.
- Description matching: use substring and keyword overlap scoring.
- BPAY references, direct debits, and EFT codes are strong matching signals.
- Timing differences (e.g., weekend processing) are common and expected.
- Flag duplicates and missing transactions for manual review.
- Financial years run July 1 to June 30 (e.g., FY 2024-25).

Use the available tools to find matches, score them, and apply actions. Return a JSON object matching the BankReconAgentOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'find_matches',
      description:
        'Find matching candidates between bank transactions and ledger entries. If bankTransactionId is provided, suggest matches for that specific transaction. Otherwise, run auto-matching for the entire session.',
      input_schema: {
        type: 'object' as const,
        properties: {
          sessionId: {
            type: 'string',
            description: 'Reconciliation session ID',
          },
          userId: { type: 'string', description: 'User ID' },
          bankTransactionId: {
            type: 'string',
            description: 'Optional: specific bank transaction to find matches for',
          },
        },
        required: ['sessionId', 'userId'],
      },
    },
    {
      name: 'score_match_confidence',
      description:
        'Score the confidence of a potential match between a bank transaction and a ledger entry. Returns individual scoring components.',
      input_schema: {
        type: 'object' as const,
        properties: {
          bankAmount: {
            type: 'number',
            description: 'Bank transaction amount in cents',
          },
          bankDate: {
            type: 'string',
            description: 'Bank transaction date (ISO)',
          },
          bankDescription: {
            type: 'string',
            description: 'Bank transaction description',
          },
          ledgerAmount: {
            type: 'number',
            description: 'Ledger entry amount in cents',
          },
          ledgerDate: {
            type: 'string',
            description: 'Ledger entry date (ISO)',
          },
          ledgerReference: {
            type: 'string',
            description: 'Ledger entry reference/description',
          },
        },
        required: [
          'bankAmount',
          'bankDate',
          'bankDescription',
          'ledgerAmount',
          'ledgerDate',
          'ledgerReference',
        ],
      },
    },
    {
      name: 'apply_matching_rules',
      description: 'Confirm, reject, or undo a match in the reconciliation session.',
      input_schema: {
        type: 'object' as const,
        properties: {
          sessionId: {
            type: 'string',
            description: 'Reconciliation session ID',
          },
          userId: { type: 'string', description: 'User ID' },
          matchId: { type: 'string', description: 'Match record ID' },
          action: {
            type: 'string',
            enum: ['confirm', 'reject', 'undo'],
            description: 'Action to take on the match',
          },
        },
        required: ['sessionId', 'userId', 'matchId', 'action'],
      },
    },
    {
      name: 'search_recon_patterns',
      description:
        'Search Cognee knowledge graph for historical reconciliation patterns, common discrepancy types, and matching rules.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query for reconciliation patterns or matching rules',
          },
        },
        required: ['query'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'find_matches',
      async (input) => {
        const sessionId = input.sessionId as string;
        const userId = input.userId as string;
        const bankTransactionId = input.bankTransactionId as string | undefined;

        try {
          if (bankTransactionId) {
            // Suggest matches for a specific bank transaction
            const suggestions = await bankReconciliationService.suggestMatches(
              sessionId,
              bankTransactionId,
            );
            return {
              mode: 'suggest',
              bankTransactionId,
              suggestions: suggestions.map((s) => ({
                ledgerEntryId: s.ledgerEntryId,
                confidence: s.confidence,
                matchReasons: s.matchReasons,
              })),
            };
          } else {
            // Auto-match entire session
            const result = await bankReconciliationService.autoMatch(sessionId, userId);
            return {
              mode: 'auto',
              matched: result.matched,
              suggested: result.suggested,
              unmatched: result.unmatched,
            };
          }
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'Failed to find matches',
          };
        }
      },
    ],
    [
      'score_match_confidence',
      async (input) => {
        const bankAmount = input.bankAmount as number;
        const bankDate = input.bankDate as string;
        const bankDescription = input.bankDescription as string;
        const ledgerAmount = input.ledgerAmount as number;
        const ledgerDate = input.ledgerDate as string;
        const ledgerReference = input.ledgerReference as string;

        // Amount scoring
        const amountDiff = Math.abs(bankAmount - ledgerAmount);
        const maxAmount = Math.max(Math.abs(bankAmount), Math.abs(ledgerAmount), 1);
        const amountRatio = amountDiff / maxAmount;
        let amountScore: number;
        if (amountDiff === 0) amountScore = 1.0;
        else if (amountRatio <= 0.01) amountScore = 0.8;
        else if (amountRatio <= 0.05) amountScore = 0.5;
        else amountScore = Math.max(0, 1.0 - amountRatio);

        // Date scoring
        const bankDateMs = new Date(bankDate).getTime();
        const ledgerDateMs = new Date(ledgerDate).getTime();
        const daysDiff = Math.abs(bankDateMs - ledgerDateMs) / (1000 * 60 * 60 * 24);
        let dateScore: number;
        if (daysDiff <= 0.5) dateScore = 1.0;
        else if (daysDiff <= 1) dateScore = 0.9;
        else if (daysDiff <= 3) dateScore = 0.7;
        else if (daysDiff <= 7) dateScore = 0.4;
        else dateScore = Math.max(0, 0.3 - (daysDiff - 7) * 0.02);

        // Description scoring (keyword overlap)
        const bankWords = new Set(
          bankDescription
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(Boolean),
        );
        const ledgerWords = new Set(
          ledgerReference
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(Boolean),
        );
        const intersection = [...bankWords].filter((w) => ledgerWords.has(w));
        const union = new Set([...bankWords, ...ledgerWords]);
        const descriptionScore = union.size > 0 ? intersection.length / union.size : 0;

        // Combined score (weighted)
        const combinedScore = amountScore * 0.5 + dateScore * 0.3 + descriptionScore * 0.2;

        return {
          amountScore: Math.round(amountScore * 100) / 100,
          dateScore: Math.round(dateScore * 100) / 100,
          descriptionScore: Math.round(descriptionScore * 100) / 100,
          combinedScore: Math.round(combinedScore * 100) / 100,
          details: {
            amountDiffCents: amountDiff,
            daysDifference: Math.round(daysDiff * 10) / 10,
            commonKeywords: intersection,
          },
        };
      },
    ],
    [
      'apply_matching_rules',
      async (input) => {
        const userId = input.userId as string;
        const matchId = input.matchId as string;
        const action = input.action as 'confirm' | 'reject' | 'undo';

        try {
          switch (action) {
            case 'confirm': {
              const match = await bankReconciliationService.confirmMatch(matchId, userId);
              return {
                success: true,
                action: 'confirmed',
                matchId,
                result: match,
              };
            }
            case 'reject': {
              await bankReconciliationService.rejectMatch(matchId, userId);
              return { success: true, action: 'rejected', matchId };
            }
            case 'undo': {
              await bankReconciliationService.undoMatch(matchId, userId);
              return { success: true, action: 'undone', matchId };
            }
            default:
              return { error: `Unknown action: ${action}` };
          }
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'Failed to apply matching rule',
          };
        }
      },
    ],
    [
      'search_recon_patterns',
      async (input) => {
        const query = input.query as string;

        try {
          const results = await cogneeTools.search(
            query,
            COGNEE_DATASETS.reconPatterns,
            'GRAPH_COMPLETION',
          );
          return { found: results.length > 0, results };
        } catch {
          return {
            found: false,
            results: [],
            error: 'Cognee search unavailable',
          };
        }
      },
    ],
  ]);

  constructor() {
    super('bank_reconciler_agent');
  }
}
