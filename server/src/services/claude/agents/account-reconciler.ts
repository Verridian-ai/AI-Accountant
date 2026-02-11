/**
 * AccountReconciler Agent
 *
 * Reconciles transactions across statements, detects duplicates,
 * verifies balances, and ensures statement continuity.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import {
  TransferDetector,
  type TransferCandidate,
  type AccountContext,
} from '../../transfers/index.js';
import type { ReconcilerInput, ReconcilerOutput } from '../types.js';

export class AccountReconcilerAgent extends ClaudeAgent<
  ReconcilerInput,
  ReconcilerOutput
> {
  protected systemPrompt = `You are a bank account reconciliation specialist. Verify that transactions across statements are consistent, detect duplicates, check opening/closing balance continuity, identify missing transactions, and flag discrepancies. You understand that statements may overlap in date ranges and that transfers between accounts should be matched.

Your workflow:
1. Use find_duplicates to detect duplicate transactions
2. Use verify_balance_continuity to check statement-to-statement balances
3. Use check_running_balance to verify individual transaction balances
4. Optionally use detect_transfers for cross-account matching
5. Use find_unmatched for any missing transactions
6. Compile results and provide a summary

Return a JSON object matching the ReconcilerOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'find_duplicates',
      description: 'Find potential duplicate transactions by amount, date, and description.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: { type: 'object' },
            description: 'Transactions to check for duplicates',
          },
          threshold: {
            type: 'number',
            description: 'Similarity threshold (0-1)',
          },
        },
        required: ['transactions'],
      },
    },
    {
      name: 'verify_balance_continuity',
      description: 'Check that opening balance of each statement matches previous closing balance.',
      input_schema: {
        type: 'object' as const,
        properties: {
          statements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                openingBalance: { type: 'number' },
                closingBalance: { type: 'number' },
                periodStart: { type: 'string' },
                periodEnd: { type: 'string' },
              },
            },
          },
        },
        required: ['statements'],
      },
    },
    {
      name: 'find_unmatched',
      description: 'Find transactions present in one source but not another.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: { type: 'object' },
          },
          bankStatement: {
            type: 'array',
            items: { type: 'object' },
          },
        },
        required: ['transactions', 'bankStatement'],
      },
    },
    {
      name: 'detect_transfers',
      description: 'Detect inter-account transfers using TransferDetector.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: { type: 'object' },
          },
          accounts: {
            type: 'array',
            items: { type: 'object' },
          },
        },
        required: ['transactions', 'accounts'],
      },
    },
    {
      name: 'check_running_balance',
      description: 'Verify running balance calculations for a sequence of transactions.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                amount: { type: 'number' },
                balance: { type: 'number' },
              },
            },
          },
          openingBalance: { type: 'number' },
        },
        required: ['transactions', 'openingBalance'],
      },
    },
    {
      name: 'search_historical_patterns',
      description: 'Search Cognee for known reconciliation patterns.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  ];

  protected toolHandlers = new Map<
    string,
    (input: Record<string, unknown>) => Promise<unknown>
  >([
    [
      'find_duplicates',
      async (input) => {
        const transactions = input.transactions as Array<{
          id: number;
          date: string;
          description: string;
          amount: number;
        }>;
        const threshold = (input.threshold as number) || 0.8;
        const duplicates: Array<{
          transaction1Id: number;
          transaction2Id: number;
          confidence: number;
          reason: string;
        }> = [];

        for (let i = 0; i < transactions.length; i++) {
          for (let j = i + 1; j < transactions.length; j++) {
            const a = transactions[i];
            const b = transactions[j];

            if (
              a.amount === b.amount &&
              a.date === b.date &&
              a.description === b.description
            ) {
              duplicates.push({
                transaction1Id: a.id,
                transaction2Id: b.id,
                confidence: 1.0,
                reason: 'Exact match on date, amount, and description',
              });
            } else if (
              a.amount === b.amount &&
              a.date === b.date
            ) {
              const confidence = 0.7;
              if (confidence >= threshold) {
                duplicates.push({
                  transaction1Id: a.id,
                  transaction2Id: b.id,
                  confidence,
                  reason: 'Same date and amount, different description',
                });
              }
            }
          }
        }

        return duplicates;
      },
    ],
    [
      'verify_balance_continuity',
      async (input) => {
        const stmts = input.statements as Array<{
          id: number;
          openingBalance: number;
          closingBalance: number;
          periodStart: string;
          periodEnd: string;
        }>;

        const sorted = [...stmts].sort((a, b) =>
          a.periodStart.localeCompare(b.periodStart)
        );

        const gaps: Array<{
          afterStatement: number;
          expectedOpening: number;
          actualOpening: number;
        }> = [];

        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];
          if (prev.closingBalance !== curr.openingBalance) {
            gaps.push({
              afterStatement: prev.id,
              expectedOpening: prev.closingBalance,
              actualOpening: curr.openingBalance,
            });
          }
        }

        return { isContiguous: gaps.length === 0, gaps };
      },
    ],
    [
      'find_unmatched',
      async (input) => {
        const txs = input.transactions as Array<{
          id: number;
          date: string;
          amount: number;
        }>;
        const bankTxs = input.bankStatement as Array<{
          id: number;
          date: string;
          amount: number;
        }>;

        const bankSet = new Set(
          bankTxs.map((t) => `${t.date}-${t.amount}`)
        );

        return txs.filter(
          (t) => !bankSet.has(`${t.date}-${t.amount}`)
        );
      },
    ],
    [
      'detect_transfers',
      async (input) => {
        const txs = input.transactions as TransferCandidate[];
        const accounts = input.accounts as AccountContext[];
        const detector = new TransferDetector();
        return detector.detectTransfers(txs, accounts);
      },
    ],
    [
      'check_running_balance',
      async (input) => {
        const txs = input.transactions as Array<{
          id: number;
          amount: number;
          balance: number;
        }>;
        const openingBalance = input.openingBalance as number;
        const discrepancies: Array<{
          transactionId: number;
          expected: number;
          actual: number;
        }> = [];

        let runningBalance = openingBalance;
        for (const tx of txs) {
          runningBalance += tx.amount;
          if (
            tx.balance !== undefined &&
            Math.abs(runningBalance - tx.balance) > 1
          ) {
            discrepancies.push({
              transactionId: tx.id,
              expected: runningBalance,
              actual: tx.balance,
            });
          }
        }

        return { valid: discrepancies.length === 0, discrepancies };
      },
    ],
    [
      'search_historical_patterns',
      async (input) => {
        const query = input.query as string;
        return cogneeTools.search(query, 'reconciliation_patterns');
      },
    ],
  ]);

  constructor() {
    super('account_reconciler');
  }
}
