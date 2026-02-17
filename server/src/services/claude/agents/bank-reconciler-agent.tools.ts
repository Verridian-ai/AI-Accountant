/**
 * Bank Reconciler Agent — Tool Definitions
 *
 * Anthropic tool schemas for match finding, confidence scoring,
 * matching rule application, and Cognee reconciliation pattern search.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const bankReconcilerTools: Anthropic.Tool[] = [
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
