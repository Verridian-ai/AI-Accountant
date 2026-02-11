/**
 * CrossAccountTracer Agent
 *
 * Traces money flows across multiple accounts, detects inter-account
 * transfers, and visualizes fund movements.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import {
  TransferDetector,
  excludeTransfers,
  type TransferCandidate,
  type AccountContext,
  type TransferMatch,
} from '../../transfers/index.js';
import type {
  CrossAccountTracerInput,
  CrossAccountTracerOutput,
} from '../types.js';

export class CrossAccountTracerAgent extends ClaudeAgent<
  CrossAccountTracerInput,
  CrossAccountTracerOutput
> {
  protected systemPrompt = `You are a forensic accountant specializing in tracing fund movements across multiple bank accounts. Detect inter-account transfers by matching debits/credits across accounts using amount, date proximity, and description analysis. Identify multi-hop transfer chains (A→B→C) and generate flow reports. Distinguish genuine transfers from coincidental amount matches.

Your workflow:
1. Use match_transfers to find transfer pairs between accounts
2. Use detect_multi_hop to find transfer chains
3. Use calculate_net_flows for net money movement between account pairs
4. Use exclude_transfers to separate transfer transactions from regular ones
5. Optionally use generate_flow_diagram for a visual representation
6. Compile results with a summary

Return a JSON object matching the CrossAccountTracerOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'match_transfers',
      description: 'Match transfer pairs between accounts using amount, date, and description.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: { type: 'array', items: { type: 'object' } },
          accounts: { type: 'array', items: { type: 'object' } },
          config: {
            type: 'object',
            properties: {
              matchWindowDays: { type: 'number' },
              amountToleranceCents: { type: 'number' },
              minConfidence: { type: 'number' },
            },
          },
        },
        required: ['transactions', 'accounts'],
      },
    },
    {
      name: 'detect_multi_hop',
      description: 'Find A→B→C transfer chains from matched transfers.',
      input_schema: {
        type: 'object' as const,
        properties: {
          matches: { type: 'array', items: { type: 'object' } },
        },
        required: ['matches'],
      },
    },
    {
      name: 'calculate_net_flows',
      description: 'Calculate net money movement between account pairs.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: { type: 'array', items: { type: 'object' } },
          accounts: { type: 'array', items: { type: 'object' } },
        },
        required: ['transactions', 'accounts'],
      },
    },
    {
      name: 'generate_flow_diagram',
      description: 'Generate a Mermaid diagram of money flows between accounts.',
      input_schema: {
        type: 'object' as const,
        properties: {
          flows: { type: 'array', items: { type: 'object' } },
        },
        required: ['flows'],
      },
    },
    {
      name: 'exclude_transfers',
      description: 'Filter out transfer transactions from a transaction list.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: { type: 'array', items: { type: 'object' } },
          matches: { type: 'array', items: { type: 'object' } },
        },
        required: ['transactions', 'matches'],
      },
    },
    {
      name: 'search_transfer_patterns',
      description: 'Search Cognee for known transfer patterns.',
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
      'match_transfers',
      async (input) => {
        const transactions = input.transactions as TransferCandidate[];
        const accounts = input.accounts as AccountContext[];
        const config = input.config as {
          matchWindowDays?: number;
          amountToleranceCents?: number;
          minConfidence?: number;
        } | undefined;

        const detector = new TransferDetector(config);
        const matches = detector.detectTransfers(transactions, accounts);

        return matches.map((m) => ({
          sourceTransactionId: m.sourceTransaction.id,
          targetTransactionId: m.targetTransaction.id,
          sourceAccountId: m.sourceTransaction.accountId,
          targetAccountId: m.targetTransaction.accountId,
          amount: Math.abs(m.sourceTransaction.amount),
          date: m.sourceTransaction.date,
          confidence: m.confidence,
          matchReasons: m.matchReasons,
        }));
      },
    ],
    [
      'detect_multi_hop',
      async (input) => {
        const matches = input.matches as Array<{
          sourceAccountId: number;
          targetAccountId: number;
          sourceTransactionId: number;
          targetTransactionId: number;
          amount: number;
        }>;

        // Build adjacency graph
        const chains: Array<{
          path: number[];
          totalAmount: number;
          transactionIds: number[];
        }> = [];

        // Simple chain detection: for each transfer, see if target account has outgoing transfer
        const outgoing = new Map<number, typeof matches[0][]>();
        for (const m of matches) {
          const existing = outgoing.get(m.sourceAccountId) || [];
          existing.push(m);
          outgoing.set(m.sourceAccountId, existing);
        }

        const visited = new Set<number>();
        for (const m of matches) {
          if (visited.has(m.sourceTransactionId)) continue;

          const path = [m.sourceAccountId];
          const txIds = [m.sourceTransactionId, m.targetTransactionId];
          let currentAccount = m.targetAccountId;
          let totalAmount = m.amount;
          visited.add(m.sourceTransactionId);

          // Follow chain
          let next = outgoing.get(currentAccount)?.find(
            (n) => !visited.has(n.sourceTransactionId)
          );
          while (next) {
            path.push(currentAccount);
            txIds.push(next.sourceTransactionId, next.targetTransactionId);
            totalAmount += next.amount;
            visited.add(next.sourceTransactionId);
            currentAccount = next.targetAccountId;
            next = outgoing.get(currentAccount)?.find(
              (n) => !visited.has(n.sourceTransactionId)
            );
          }
          path.push(currentAccount);

          if (path.length > 2) {
            chains.push({ path, totalAmount, transactionIds: txIds });
          }
        }

        return chains;
      },
    ],
    [
      'calculate_net_flows',
      async (input) => {
        const transactions = input.transactions as TransferCandidate[];
        const accounts = input.accounts as AccountContext[];

        const detector = new TransferDetector();
        const matches = detector.detectTransfers(transactions, accounts);

        // Aggregate net flows between account pairs
        const flowMap = new Map<
          string,
          { fromAccountId: number; toAccountId: number; netAmount: number; count: number }
        >();

        for (const m of matches) {
          const key = `${m.sourceTransaction.accountId}-${m.targetTransaction.accountId}`;
          const reverseKey = `${m.targetTransaction.accountId}-${m.sourceTransaction.accountId}`;

          if (flowMap.has(reverseKey)) {
            const existing = flowMap.get(reverseKey)!;
            existing.netAmount -= Math.abs(m.sourceTransaction.amount);
            existing.count++;
          } else {
            const existing = flowMap.get(key) || {
              fromAccountId: m.sourceTransaction.accountId,
              toAccountId: m.targetTransaction.accountId,
              netAmount: 0,
              count: 0,
            };
            existing.netAmount += Math.abs(m.sourceTransaction.amount);
            existing.count++;
            flowMap.set(key, existing);
          }
        }

        return Array.from(flowMap.values()).map((f) => ({
          fromAccountId: f.fromAccountId,
          toAccountId: f.toAccountId,
          netAmount: f.netAmount,
          transactionCount: f.count,
        }));
      },
    ],
    [
      'generate_flow_diagram',
      async (input) => {
        const flows = input.flows as Array<{
          fromAccountId: number;
          toAccountId: number;
          netAmount: number;
          transactionCount: number;
        }>;

        const lines = ['graph LR'];
        for (const flow of flows) {
          const amount = (Math.abs(flow.netAmount) / 100).toFixed(2);
          const from = flow.netAmount >= 0 ? flow.fromAccountId : flow.toAccountId;
          const to = flow.netAmount >= 0 ? flow.toAccountId : flow.fromAccountId;
          lines.push(
            `    A${from}[Account ${from}] -->|$${amount} (${flow.transactionCount}x)| A${to}[Account ${to}]`
          );
        }

        return { mermaid: lines.join('\n') };
      },
    ],
    [
      'exclude_transfers',
      async (input) => {
        const transactions = input.transactions as TransferCandidate[];
        const matches = input.matches as TransferMatch[];
        return excludeTransfers(transactions, matches);
      },
    ],
    [
      'search_transfer_patterns',
      async (input) => {
        const query = input.query as string;
        return cogneeTools.search(query, 'transfer_patterns');
      },
    ],
  ]);

  constructor() {
    super('cross_account_tracer');
  }
}
