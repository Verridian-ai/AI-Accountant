/**
 * Payment Matching Agent
 *
 * Australian payment reconciliation agent using Claude. Matches OCR-extracted
 * documents (invoices, receipts, bills) against bank transactions with
 * intelligent scoring, rule application, and pattern learning.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { PaymentMatchingService } from '../../payment-matching.js';
import { db, ocrDocuments, transactions } from '../../../schema.js';
import { eq } from 'drizzle-orm';
import type { PaymentMatchingInput, PaymentMatchingOutput } from '../types.js';

const matchingService = new PaymentMatchingService();

export class PaymentMatchingAgent extends ClaudeAgent<PaymentMatchingInput, PaymentMatchingOutput> {
  protected systemPrompt = `You are an expert payment reconciliation agent for an Australian small business accounting platform.
You match invoices, receipts, and bills extracted via OCR against bank transaction records.

Key responsibilities:
- Find the most likely matching bank transaction for each document
- Score matches based on amount, date proximity, vendor name, and historical patterns
- Apply and manage matching rules for recurring payments
- Learn from confirmed matches to improve future accuracy
- Handle edge cases: partial payments, split transactions, GST-inclusive vs exclusive amounts

Matching intelligence:
- An invoice for $1,100 (incl GST) should match a bank debit of $1,100
- Vendor names in bank transactions are often abbreviated (e.g., "TELSTRA" vs "Telstra Corporation Ltd")
- Recurring bills (rent, utilities) typically arrive on similar dates each month
- Credit notes should match positive bank transactions (refunds)
- Payment timing: invoices are often paid 7-30 days after document date
- Multiple line items on one invoice match a single bank transaction

Analyze the input thoroughly using the available tools, then return a JSON object matching the PaymentMatchingOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'find_match_candidates',
      description:
        'Find potential bank transaction matches for an OCR-extracted document. Returns candidates sorted by confidence score descending.',
      input_schema: {
        type: 'object' as const,
        properties: {
          documentId: {
            type: 'string',
            description: 'The UUID of the OCR document to find matches for',
          },
          amountTolerance: {
            type: 'number',
            description: 'Amount tolerance in dollars for fuzzy matching (default: 1.0)',
          },
          dateTolerance: {
            type: 'number',
            description: 'Date tolerance in days for temporal matching (default: 30)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of candidates to return (default: 10)',
          },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'score_match',
      description:
        'Calculate a detailed match score between an OCR document and a specific bank transaction. Returns per-factor breakdown and overall confidence.',
      input_schema: {
        type: 'object' as const,
        properties: {
          documentId: { type: 'string', description: 'The UUID of the OCR document' },
          transactionId: {
            type: 'string',
            description: 'The ID of the bank transaction to score against',
          },
        },
        required: ['documentId', 'transactionId'],
      },
    },
    {
      name: 'apply_matching_rules',
      description:
        'Apply user-defined matching rules to find definitive matches for a document. Returns the best rule-based match or null if no rules match.',
      input_schema: {
        type: 'object' as const,
        properties: {
          documentId: {
            type: 'string',
            description: 'The UUID of the OCR document to apply rules against',
          },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'learn_matching_pattern',
      description:
        'Learn from a confirmed match to create or refine matching rules. Analyzes the match pattern and optionally creates a new rule for future matches.',
      input_schema: {
        type: 'object' as const,
        properties: {
          matchId: {
            type: 'string',
            description: 'The UUID of the confirmed payment match to learn from',
          },
        },
        required: ['matchId'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'find_match_candidates',
      async (input) => {
        const documentId = input.documentId as string;
        const options: Record<string, unknown> = {};
        if (input.amountTolerance != null)
          options.amountTolerance = input.amountTolerance as number;
        if (input.dateTolerance != null) options.dateTolerance = input.dateTolerance as number;
        if (input.limit != null) options.limit = input.limit as number;
        return await matchingService.findMatchCandidates(documentId, options);
      },
    ],
    [
      'score_match',
      async (input) => {
        const documentId = input.documentId as string;
        const transactionId = input.transactionId as string;

        const doc = await db
          .select()
          .from(ocrDocuments)
          .where(eq(ocrDocuments.id, documentId))
          .get();
        if (!doc) throw new Error(`Document not found: ${documentId}`);

        const tx = await db
          .select()
          .from(transactions)
          .where(eq(transactions.id, transactionId))
          .get();
        if (!tx) throw new Error(`Transaction not found: ${transactionId}`);

        return await matchingService.scoreMatch(doc, tx);
      },
    ],
    [
      'apply_matching_rules',
      async (input) => {
        const documentId = input.documentId as string;
        const result = await matchingService.applyRules(documentId);
        return result ?? { matched: false, message: 'No matching rules found for this document' };
      },
    ],
    [
      'learn_matching_pattern',
      async (input) => {
        const matchId = input.matchId as string;
        await matchingService.learnFromConfirmation(matchId);
        return { learned: true, matchId };
      },
    ],
  ]);

  constructor() {
    super('payment_matching');
  }
}
