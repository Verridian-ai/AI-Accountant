/**
 * TransactionCategorizer Agent
 *
 * Categorizes transactions using merchant memory, Cognee context,
 * and Claude reasoning. Supports batch processing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import { cogneeClient } from '../../cognee_client.js';
import type { CategorizerInput, CategorizerOutput, TokenUsage } from '../types.js';

// Category taxonomy — kept in sync with client/src/features/transactions/constants/categories.ts
const CATEGORY_TAXONOMY = [
  'Salary & Wages',
  'Business Income',
  'Investment Income',
  'Government Benefits',
  'Rental Income',
  'Other Income',
  'Groceries',
  'Dining & Takeaway',
  'Transport',
  'Fuel',
  'Utilities',
  'Rent',
  'Mortgage',
  'Insurance',
  'Medical & Health',
  'Education',
  'Entertainment',
  'Clothing & Personal',
  'Home & Garden',
  'Subscriptions',
  'Phone & Internet',
  'Professional Fees',
  'Office Supplies',
  'Travel',
  'Charity & Donations',
  'Childcare',
  'Pet Care',
  'Bank Fees',
  'Interest Charged',
  'Interest Earned',
  'Tax',
  'Superannuation',
  'Transfer',
  'Cash Withdrawal',
  'Refund',
  'Uncategorized',
];

export class TransactionCategorizerAgent extends ClaudeAgent<CategorizerInput, CategorizerOutput> {
  protected systemPrompt = `You are an Australian financial transaction categorizer. Categorize bank transactions into the correct category from the provided taxonomy. Consider merchant memory (previous categorizations of the same merchant), transaction description patterns, and amount ranges.

For each transaction, return a category, confidence score, GST category, and reasoning notes.

GST categories: "gst_free", "gst_applicable", "input_taxed", "capital", "private"

Your workflow:
1. Use get_category_taxonomy to get the full category list
2. Use lookup_merchant_memory for each unique merchant pattern
3. Use search_similar_transactions if no merchant memory match
4. Process all transactions and return structured results

Return a JSON object matching the CategorizerOutput schema with "results" and "lowConfidenceIds" arrays.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'lookup_merchant_memory',
      description: 'Check if a merchant was previously categorized in merchant memory.',
      input_schema: {
        type: 'object' as const,
        properties: {
          description: {
            type: 'string',
            description: 'Transaction description to look up',
          },
        },
        required: ['description'],
      },
    },
    {
      name: 'search_similar_transactions',
      description: 'Find similar past transactions via Cognee knowledge graph.',
      input_schema: {
        type: 'object' as const,
        properties: {
          description: {
            type: 'string',
            description: 'Transaction description to search',
          },
          amount: {
            type: 'number',
            description: 'Transaction amount in cents',
          },
        },
        required: ['description'],
      },
    },
    {
      name: 'get_category_taxonomy',
      description: 'Get the full list of valid categories.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'batch_categorize',
      description: 'Process up to 20 transactions at once using rules and patterns.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            description: 'Transactions to categorize',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                description: { type: 'string' },
                amount: { type: 'number' },
              },
            },
          },
        },
        required: ['transactions'],
      },
    },
  ];

  private merchantMemory: Array<{
    pattern: string;
    category: string;
    gst: boolean;
  }> = [];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'lookup_merchant_memory',
      async (input) => {
        const description = (input.description as string).toLowerCase();
        for (const mem of this.merchantMemory) {
          if (
            description.includes(mem.pattern.toLowerCase()) ||
            mem.pattern.toLowerCase().includes(description.substring(0, 15))
          ) {
            return {
              found: true,
              pattern: mem.pattern,
              category: mem.category,
              gst: mem.gst,
            };
          }
        }
        return { found: false };
      },
    ],
    [
      'search_similar_transactions',
      async (input) => {
        const description = input.description as string;
        return cogneeTools.search(description, 'bank_transactions', 'CHUNKS');
      },
    ],
    [
      'get_category_taxonomy',
      async () => {
        return { categories: CATEGORY_TAXONOMY };
      },
    ],
    [
      'batch_categorize',
      async (input) => {
        // This tool provides rule-based pre-categorization hints
        const transactions = input.transactions as Array<{
          id: number;
          description: string;
          amount: number;
        }>;

        const suggestions = transactions.map((tx) => {
          const desc = tx.description.toLowerCase();
          // Quick pattern matching for obvious categories
          if (desc.includes('salary') || desc.includes('wages') || desc.includes('payroll'))
            return { id: tx.id, suggestedCategory: 'Salary & Wages', confidence: 0.9 };
          if (desc.includes('woolworths') || desc.includes('coles') || desc.includes('aldi'))
            return { id: tx.id, suggestedCategory: 'Groceries', confidence: 0.85 };
          if (desc.includes('uber eats') || desc.includes('menulog') || desc.includes('doordash'))
            return { id: tx.id, suggestedCategory: 'Dining & Takeaway', confidence: 0.85 };
          if (desc.includes('uber') || desc.includes('taxi') || desc.includes('opal'))
            return { id: tx.id, suggestedCategory: 'Transport', confidence: 0.8 };
          if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('disney'))
            return { id: tx.id, suggestedCategory: 'Subscriptions', confidence: 0.9 };
          if (desc.includes('transfer') || desc.includes('tfr'))
            return { id: tx.id, suggestedCategory: 'Transfer', confidence: 0.8 };
          if (desc.includes('interest'))
            return {
              id: tx.id,
              suggestedCategory: tx.amount > 0 ? 'Interest Earned' : 'Interest Charged',
              confidence: 0.85,
            };

          return { id: tx.id, suggestedCategory: null as string | null, confidence: 0 };
        });

        // Propose mutations for categorized transactions
        if (this.mutationTools) {
          const categorizedSuggestions = suggestions.filter(
            (s) => s.suggestedCategory != null && s.confidence > 0,
          );
          if (categorizedSuggestions.length > 0) {
            try {
              const proposals = categorizedSuggestions.map((s) => ({
                agentType: 'transaction_categorizer' as const,
                mutationType: 'update' as const,
                targetTable: 'transactions',
                targetId: String(s.id),
                beforeState: { category: 'Uncategorized' },
                afterState: { category: s.suggestedCategory },
                description: `Batch categorize transaction ${s.id} as '${s.suggestedCategory}'`,
                confidence: s.confidence,
                requiresConfirmation: s.confidence < 0.9,
              }));
              await this.mutationTools.batchProposeMutations(proposals);
            } catch (err) {
              console.warn('[TransactionCategorizer] Batch mutation proposal failed:', err);
            }
          }
        }

        return suggestions;
      },
    ],
  ]);

  constructor() {
    super('transaction_categorizer');
  }

  /**
   * Override invoke to inject merchant memory before agent loop,
   * and store new merchant mappings back to Cognee after categorization
   * (learning loop).
   */
  async invoke(input: CategorizerInput) {
    this.merchantMemory = input.existingMerchantMemory || [];
    const output: CategorizerOutput & { usage: TokenUsage } = await super.invoke(input);

    // Learning loop: store high-confidence categorizations back to Cognee
    // so future runs benefit from merchant memory.
    const highConfidenceResults = output.results.filter(
      (r) => r.confidence >= 0.8 && r.merchantKey,
    );
    if (highConfidenceResults.length > 0) {
      // Build a lookup from input transactions for descriptions
      const txMap = new Map(input.transactions.map((tx) => [tx.id, tx]));

      for (const result of highConfidenceResults) {
        const tx = txMap.get(result.transactionId);
        if (!tx) continue;

        const gstApplicable = result.gstCategory === 'gst_applicable';
        try {
          await cogneeClient.storeMerchantMapping(
            result.merchantKey!, // abbreviated name (merchant key)
            result.merchantKey!, // canonical name (use merchant key as best available)
            undefined, // abn
            gstApplicable,
            undefined, // industry
            result.category, // default category
          );
        } catch {
          // Non-fatal: don't break categorization if Cognee store fails
        }
      }
    }

    // Propose category update mutations for all categorized results
    if (this.mutationTools) {
      const categorizedResults = output.results.filter(
        (r) => r.category && r.category !== 'Uncategorized',
      );
      if (categorizedResults.length > 0) {
        try {
          const proposals = categorizedResults.map((r) => ({
            agentType: 'transaction_categorizer' as const,
            mutationType: 'update' as const,
            targetTable: 'transactions',
            targetId: String(r.transactionId),
            beforeState: { category: 'Uncategorized' },
            afterState: {
              category: r.category,
              gst_category: r.gstCategory,
              ...(r.gstAmount != null ? { gst_amount: r.gstAmount } : {}),
            },
            description: `Categorize transaction ${r.transactionId} as '${r.category}' (${r.gstCategory})`,
            confidence: r.confidence,
            requiresConfirmation: r.confidence < 0.9,
          }));
          await this.mutationTools.batchProposeMutations(proposals);
        } catch (err) {
          console.warn('[TransactionCategorizer] Mutation proposal for results failed:', err);
        }
      }
    }

    return output;
  }
}
