/**
 * Vercel AI SDK — Transaction Categorizer Agent
 *
 * Drop-in replacement for TransactionCategorizerAgent (legacy ClaudeAgent)
 * using the Vercel AI SDK with Zod structured output.
 */

import { VercelAgent } from '../../vercel-agent.js';
import { adaptLegacyTool } from '../../tool-adapter.js';
import { CategorizerOutputSchema } from '../../schemas/categorizer-output.js';
import { cogneeTools } from '../../cognee-tools.js';
import { cogneeClient } from '../../../cognee_client.js';
import type {
  CategorizerInput,
  CategorizerOutput,
  VercelAgentExecutionResult,
} from '../../types.js';
import type { ToolSet } from 'ai';

// Category taxonomy — kept in sync with client/src/features/transactions/constants/categories.ts
const CATEGORY_TAXONOMY = [
  // Revenue (4-xxxx)
  'Sales Revenue',
  'Service Revenue',
  'Interest Income',
  'Other Income',
  'Export Revenue',
  'Business Income',
  'Rental Income',
  // Cost of Sales (5-xxxx)
  'Cost of Goods Sold',
  'Direct Labour',
  'Freight Costs',
  'Materials',
  // Expenses (6-xxxx)
  'Advertising & Marketing',
  'Bank Fees',
  'Computer & IT',
  'Depreciation',
  'Entertainment',
  'Insurance',
  'Interest Expense',
  'Motor Vehicle Expenses',
  'Office Supplies',
  'Professional Fees',
  'Rent',
  'Repairs & Maintenance',
  'Subscriptions',
  'Software & Subscriptions',
  'Telephone & Internet',
  'Travel',
  'Travel & Accommodation',
  'Utilities',
  'Wages & Salaries',
  'Superannuation',
  'Work from Home Expenses',
  'General Expenses',
  'Miscellaneous',
  'Charity & Donations',
  'Clothing & Personal',
  'Dining & Takeaway',
  'Education',
  'Fuel',
  'Groceries',
  'Home & Garden',
  'Medical & Health',
  'Pet Care',
  'Tax',
  'Tax Payments',
  // System
  'Cash Withdrawal',
  'Loan Repayment',
  'Mortgage',
  'Refund',
  'Transfer',
  'Uncategorized',
];

const SYSTEM_PROMPT = `You are an Australian financial transaction categorizer for Amica Beauty, a beauty salon/shop in the Illawarra region, NSW. Categorize bank transactions into the correct category from the provided taxonomy. Consider merchant memory (previous categorizations of the same merchant), transaction description patterns, and amount ranges.

For each transaction, return a category, confidence score, GST category, and reasoning notes.

GST categories: "taxable_10", "gst_free", "input_taxed", "capital", "private"

BUSINESS-SPECIFIC RULES (Amica Beauty):
- ONLY deposits starting with "POS" are Sales Revenue (EFTPOS sales)
- All other deposits (bank transfers, "Payment Received", etc.) are owner contributions -> "Transfer" with gst_category "private"
- Cash withdrawals (ATM, Wdl ATM) are stock purchases -> "Cost of Goods Sold" with gst_category "taxable_10"
- Afterpay purchases are shop supplies -> "Cost of Goods Sold" with gst_category "taxable_10"
- Known employees: Bree Perry, Christina Josevski, J Driscoll, A Fleuren, J Fleuren, E Driscoll
- Staff food/lunch transfers (e.g. "Transfer To E DRISCOLL Food") -> "Dining & Takeaway"
- Beauty/salon supply merchants (Inskin Cosmedics, Hair & Beauty Collective, etc.) -> "Cost of Goods Sold"

LOAN CATEGORIZATION RULES:
- Bizloan/BizLend/Bizcap deposits (positive amounts): "Loan Repayment" -- these are loan drawdowns, NOT business income
- Loan repayments (negative amounts with loan keywords): "Loan Repayment"
- Interest charges on loans (negative): "Interest Expense"
- Interest earned on deposits (positive): "Interest Income"
- Mortgage payments: "Mortgage"

GST RULES:
- Everything spent is GST claimable (taxable_10) UNLESS wages or loan payments
- Wages & Salaries -> gst_category "private" (not GST claimable)
- Loan Repayment -> gst_category "private" (not GST claimable)
- Transfers -> gst_category "private"
- Bank interest -> gst_category "input_taxed"

POS TRANSACTION RULES:
- Categorize based on merchant name, not just "POS" prefix
- Common merchants: Woolworths/Coles/Aldi = Groceries, Shell/BP = Fuel, etc.

Your workflow:
1. Use get_category_taxonomy to get the full category list
2. Use lookup_merchant_memory for each unique merchant pattern
3. Use search_similar_transactions if no merchant memory match
4. Process all transactions and return structured results

Return a JSON object matching the CategorizerOutput schema with "results" and "lowConfidenceIds" arrays.`;

export class VercelTransactionCategorizer extends VercelAgent<CategorizerInput, CategorizerOutput> {
  private merchantMemory: Array<{
    pattern: string;
    category: string;
    gst: boolean;
  }> = [];

  constructor() {
    super('transaction_categorizer', SYSTEM_PROMPT, CategorizerOutputSchema);
  }

  getTools(sessionId?: string): ToolSet {
    const tools: ToolSet = {};

    tools['lookup_merchant_memory'] = adaptLegacyTool(
      'lookup_merchant_memory',
      'Check if a merchant was previously categorized in merchant memory.',
      {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Transaction description to look up',
          },
        },
        required: ['description'],
      },
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
    );

    tools['search_similar_transactions'] = adaptLegacyTool(
      'search_similar_transactions',
      'Find similar past transactions via Cognee knowledge graph.',
      {
        type: 'object',
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
      async (input) => {
        const description = input.description as string;
        return cogneeTools.search(description, 'bank_transactions', 'CHUNKS', sessionId);
      },
    );

    tools['get_category_taxonomy'] = adaptLegacyTool(
      'get_category_taxonomy',
      'Get the full list of valid categories.',
      {
        type: 'object',
        properties: {},
        required: [],
      },
      async () => {
        return { categories: CATEGORY_TAXONOMY };
      },
    );

    tools['search_transaction_patterns'] = adaptLegacyTool(
      'search_transaction_patterns',
      'Search knowledge graph for similar transaction patterns using DataPoint-structured entity matching. Returns context from previously categorized transactions.',
      {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query for finding similar transactions' },
          category: { type: 'string', description: 'Optional category filter' },
        },
        required: ['query'],
      },
      async (input) => {
        const query = input.query as string;
        const category = input.category as string | undefined;
        const searchQuery = category ? `${query} category:${category}` : query;
        const results = await cogneeTools.searchWithDataPoint(searchQuery, 'FinancialTransaction', sessionId);
        return { patterns: results.length > 0 ? results : [], count: results.length };
      },
    );

    tools['temporal_categorization_search'] = adaptLegacyTool(
      'temporal_categorization_search',
      'Find how merchants were categorized in recent months. Searches time-relevant categorization patterns.',
      {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (e.g., merchant name or category)' },
          dateRange: {
            type: 'object',
            description: 'Optional date range. Defaults to last 3 months if omitted.',
            properties: {
              start: { type: 'string', description: 'Start date (ISO format)' },
              end: { type: 'string', description: 'End date (ISO format)' },
            },
            required: ['start', 'end'],
          },
        },
        required: ['query'],
      },
      async (input) => {
        const query = input.query as string;
        const dateRange = input.dateRange as { start: string; end: string } | undefined;
        const now = new Date();
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const range = dateRange ?? {
          start: threeMonthsAgo.toISOString().slice(0, 10),
          end: now.toISOString().slice(0, 10),
        };
        try {
          const results = await cogneeTools.temporalSearch(query, 'transaction_patterns', range, sessionId);
          return { patterns: results.length > 0 ? results : [], count: results.length };
        } catch {
          return { patterns: [], count: 0, error: 'Temporal search unavailable' };
        }
      },
    );

    tools['batch_categorize'] = adaptLegacyTool(
      'batch_categorize',
      'Process up to 20 transactions at once using rules and patterns.',
      {
        type: 'object',
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
      async (input) => {
        const transactions = input.transactions as Array<{
          id: number;
          description: string;
          amount: number;
        }>;

        return transactions.map((tx) => {
          const desc = tx.description.toLowerCase();

          // --- Amica Beauty: POS deposits = Sales Revenue ---
          if (desc.startsWith('pos ') && tx.amount > 0)
            return { id: tx.id, suggestedCategory: 'Sales Revenue', confidence: 0.95 };

          // --- Loan-related patterns (Bizcap/BizLend = loan drawdowns, NOT income) ---
          if (
            desc.includes('bizloan') ||
            desc.includes('biz loan') ||
            desc.includes('bizlend') ||
            desc.includes('bizcap')
          )
            return { id: tx.id, suggestedCategory: 'Loan Repayment', confidence: 0.95 };
          if (
            desc.includes('loan repay') ||
            desc.includes('principal') ||
            (desc.includes('loan') && tx.amount < 0)
          )
            return { id: tx.id, suggestedCategory: 'Loan Repayment', confidence: 0.9 };
          if (desc.includes('mortgage') || desc.includes('home loan'))
            return { id: tx.id, suggestedCategory: 'Mortgage', confidence: 0.9 };

          // --- Interest patterns (refined by direction) ---
          if (desc.includes('interest') && tx.amount > 0)
            return { id: tx.id, suggestedCategory: 'Interest Income', confidence: 0.85 };
          if (desc.includes('interest') && tx.amount < 0)
            return { id: tx.id, suggestedCategory: 'Interest Expense', confidence: 0.85 };

          // --- POS merchant patterns ---
          if (
            desc.includes('woolworths') ||
            desc.includes('coles') ||
            desc.includes('aldi') ||
            desc.includes('iga')
          )
            return { id: tx.id, suggestedCategory: 'Groceries', confidence: 0.9 };
          if (
            desc.includes('shell') ||
            desc.includes('bp ') ||
            desc.includes('caltex') ||
            desc.includes('ampol') ||
            desc.includes('7-eleven') ||
            desc.includes('united petrol')
          )
            return { id: tx.id, suggestedCategory: 'Fuel', confidence: 0.9 };
          if (desc.includes('bunnings'))
            return { id: tx.id, suggestedCategory: 'Home & Garden', confidence: 0.85 };
          if (desc.includes('officeworks'))
            return { id: tx.id, suggestedCategory: 'Office Supplies', confidence: 0.9 };
          if (desc.includes('jb hi') || desc.includes('harvey norman'))
            return { id: tx.id, suggestedCategory: 'Computer & IT', confidence: 0.8 };

          // --- Bank & fees ---
          if (
            desc.includes('monthly fee') ||
            desc.includes('account fee') ||
            desc.includes('overdrawn fee')
          )
            return { id: tx.id, suggestedCategory: 'Bank Fees', confidence: 0.95 };

          // --- ATM/Cash -> Cost of Goods Sold (stock purchases for Amica Beauty) ---
          if (
            desc.includes('atm') ||
            desc.includes('cash withdrawal') ||
            desc.includes('cwl') ||
            desc.includes('wdl atm')
          )
            return { id: tx.id, suggestedCategory: 'Cost of Goods Sold', confidence: 0.9 };

          // --- Afterpay -> Cost of Goods Sold (shop supplies) ---
          if (desc.includes('afterpay'))
            return { id: tx.id, suggestedCategory: 'Cost of Goods Sold', confidence: 0.85 };

          // --- Beauty/Salon supplies -> Cost of Goods Sold ---
          if (
            desc.includes('inskin cosmedics') ||
            desc.includes('hair & beauty') ||
            desc.includes('beauty collect')
          )
            return { id: tx.id, suggestedCategory: 'Cost of Goods Sold', confidence: 0.9 };

          // --- Refunds ---
          if (desc.includes('refund') || desc.includes('reversal'))
            return { id: tx.id, suggestedCategory: 'Refund', confidence: 0.85 };

          // --- Existing general patterns ---
          if (desc.includes('salary') || desc.includes('wages') || desc.includes('payroll'))
            return { id: tx.id, suggestedCategory: 'Wages & Salaries', confidence: 0.9 };
          if (desc.includes('uber eats') || desc.includes('menulog') || desc.includes('doordash'))
            return { id: tx.id, suggestedCategory: 'Dining & Takeaway', confidence: 0.85 };
          if (desc.includes('uber') || desc.includes('taxi') || desc.includes('opal'))
            return { id: tx.id, suggestedCategory: 'Travel', confidence: 0.8 };
          if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('disney'))
            return { id: tx.id, suggestedCategory: 'Subscriptions', confidence: 0.9 };
          if (desc.includes('transfer') || desc.includes('tfr'))
            return { id: tx.id, suggestedCategory: 'Transfer', confidence: 0.8 };

          return { id: tx.id, suggestedCategory: null, confidence: 0 };
        });
      },
    );

    return tools;
  }

  buildPrompt(input: CategorizerInput): string {
    return `Categorize these ${input.transactions.length} transactions:\n${JSON.stringify(input.transactions, null, 2)}\n\nExisting merchant memory: ${JSON.stringify(input.existingMerchantMemory)}`;
  }

  /**
   * Build a sensible fallback output when execution fails,
   * marking all transactions as Uncategorized with zero confidence.
   */
  protected override buildFallbackOutput(
    input: CategorizerInput,
    _error: unknown,
  ): CategorizerOutput {
    return {
      results: input.transactions.map((tx) => ({
        transactionId: tx.id,
        category: 'Uncategorized',
        confidence: 0,
        gstCategory: 'private',
        aiReasoningNotes: 'Fallback: Vercel agent execution failed',
      })),
      lowConfidenceIds: input.transactions.map((tx) => tx.id),
    };
  }

  /**
   * Execute with merchant memory pre-loaded.
   * Mirrors the legacy agent's invoke() which injects merchant memory
   * before the agent loop.
   */
  async executeWithMemory(
    input: CategorizerInput,
  ): Promise<VercelAgentExecutionResult<CategorizerOutput>> {
    const { sessionId, userId } = input;
    this.merchantMemory = input.existingMerchantMemory ?? [];
    const result = await this.execute(input);

    // Feedback loop: submit search feedback for low-confidence categorizations
    const lowConfidenceResults = result.output.results.filter((r) => r.confidence < 0.7);
    for (const res of lowConfidenceResults) {
      const tx = input.transactions.find((t) => t.id === res.transactionId);
      if (!tx) continue;
      try {
        await cogneeTools.submitSearchFeedback(
          tx.description,
          String(res.transactionId),
          'partial',
          res.category,
        );
      } catch {
        // Non-fatal: don't break categorization if feedback submission fails
      }
    }

    // Learning loop: store high-confidence categorizations back to Cognee
    const highConfidenceResults = result.output.results.filter(
      (r) => r.confidence >= 0.8 && r.merchantKey,
    );
    if (highConfidenceResults.length > 0) {
      const txMap = new Map(input.transactions.map((tx) => [tx.id, tx]));
      for (const res of highConfidenceResults) {
        const tx = txMap.get(res.transactionId);
        if (!tx) continue;
        const gstApplicable = res.gstCategory === 'gst_applicable';
        try {
          await cogneeClient.storeMerchantMapping(
            res.merchantKey!,
            res.merchantKey!,
            undefined,
            gstApplicable,
            undefined,
            res.category,
          );
        } catch {
          // Non-fatal: don't break categorization if Cognee store fails
        }
      }
    }

    return result;
  }
}
