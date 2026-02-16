import OpenAI from 'openai';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';

dotenv.config({ path: '../env.local' });

export interface AIModelResponse {
  content: string;
  usage?: number;
}

export interface VisionParseResult {
  transactions: Array<{
    date: string;
    description: string;
    amount_cents: number;
    balance_cents?: number;
  }>;
}

export type VisionModel = 'gpt-5.2-vision' | 'gemini-3.0-pro';
export type ReasoningModel = 'o1' | 'o3-mini' | 'gemini-3.0-thinking';

export class AIService {
  private client: OpenAI;

  constructor() {
    const openrouterKey = process.env.VITE_OPENROUTER_API_KEY;
    const openaiKey = process.env.VITE_OPENAI_API_KEY;

    // Default to OpenRouter if available, otherwise direct OpenAI
    const apiKey = openrouterKey || openaiKey;
    const baseURL = openrouterKey ? 'https://openrouter.ai/api/v1' : undefined;

    if (!apiKey) {
      console.warn('No API Key found for AI Service!');
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'dummy',
      baseURL: baseURL,
      dangerouslyAllowBrowser: false,
    });
  }

  async parseWithVision(
    imagePaths: string[],
    model: string = 'google/gemini-3-flash-preview',
  ): Promise<VisionParseResult> {
    console.log(`[AI Vision] Processing ${imagePaths.length} images with ${model}...`);
    const modelId = model || 'google/gemini-3-flash-preview';

    const prompt = `
      You are an expert financial OCR machine. 
      Analyze these bank statement images. 
      Extract strict JSON data for ALL transactions. 
      JSON Schema:
      {
        "transactions": [
          {
            "date": "YYYY-MM-DD",
            "description": "text",
            "amount_cents": 1234, // integer, negative for DEBIT, positive for CREDIT
            "balance_cents": 1234
          }
        ]
      }
      If a field is missing, guess logically or omit. Return ONLY JSON.
    `;

    try {
      const contentImages = await Promise.all(
        imagePaths.map(async (path) => {
          const buffer = await readFile(path);
          const b64 = buffer.toString('base64');
          return {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${b64}`,
              detail: 'high',
            },
          } as unknown as OpenAI;
        }),
      );

      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }, ...contentImages],
          },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content;
      return JSON.parse(raw || '{"transactions": []}');
    } catch (err) {
      console.error('[AI Vision Error]', err);
      throw err;
    }
  }

  /**
   * Parse a PDF by rendering each page to an image and sending batches to a vision model.
   * Returns structured transaction data. Handles multi-page PDFs by batching pages.
   */
  async parseWithVisionBatched(
    pdfPath: string,
    model: string = 'google/gemini-3-flash-preview',
    pagesPerBatch: number = 5,
  ): Promise<{
    transactions: Array<{
      date: string;
      description: string;
      amount_cents: number;
      balance_cents?: number;
    }>;
  }> {
    console.log(`[AI Vision Batched] Rendering PDF pages from: ${pdfPath}`);
    const modelId = model || 'google/gemini-3-flash-preview';

    // Render all pages to PNG buffers (dynamic import to avoid DOMMatrix error in Node.js tests)
    const { pdf } = await import('pdf-to-img');
    const pageBuffers: Buffer[] = [];
    for await (const image of await pdf(pdfPath, { scale: 2.0 })) {
      pageBuffers.push(Buffer.from(image));
    }
    console.log(`[AI Vision Batched] Rendered ${pageBuffers.length} pages`);

    if (pageBuffers.length === 0) {
      return { transactions: [] };
    }

    // Process in batches
    const allTransactions: Array<{
      date: string;
      description: string;
      amount_cents: number;
      balance_cents?: number;
    }> = [];

    for (let batchStart = 0; batchStart < pageBuffers.length; batchStart += pagesPerBatch) {
      const batchEnd = Math.min(batchStart + pagesPerBatch, pageBuffers.length);
      const batch = pageBuffers.slice(batchStart, batchEnd);
      const batchNum = Math.floor(batchStart / pagesPerBatch) + 1;
      const totalBatches = Math.ceil(pageBuffers.length / pagesPerBatch);

      console.log(
        `[AI Vision Batched] Processing batch ${batchNum}/${totalBatches} (pages ${batchStart + 1}-${batchEnd})`,
      );

      const prompt = `You are an expert financial OCR machine.
Analyze these bank statement page images (pages ${batchStart + 1} to ${batchEnd} of ${pageBuffers.length}).
Extract ALL transactions visible on these pages.

Return strict JSON:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "transaction description",
      "amount_cents": -1234,
      "balance_cents": 5678
    }
  ]
}

Rules:
- amount_cents: INTEGER in cents. NEGATIVE for debits/withdrawals, POSITIVE for credits/deposits
- balance_cents: INTEGER in cents, include if visible
- Parse dates to YYYY-MM-DD
- Clean descriptions (remove extra whitespace)
- Include EVERY transaction row visible, do not skip any
- If a transaction spans multiple lines, combine into one entry
- Return ONLY valid JSON`;

      try {
        const contentImages = batch.map((buf) => ({
          type: 'image_url' as const,
          image_url: {
            url: `data:image/png;base64,${buf.toString('base64')}`,
            detail: 'high' as const,
          },
        }));

        const response = await this.client.chat.completions.create({
          model: modelId,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: prompt }, ...contentImages] as any,
            },
          ],
          response_format: { type: 'json_object' },
        });

        const raw = response.choices[0].message.content;
        const parsed = JSON.parse(raw || '{"transactions": []}');
        const batchTxs = parsed.transactions || [];
        console.log(
          `[AI Vision Batched] Batch ${batchNum} extracted ${batchTxs.length} transactions`,
        );
        allTransactions.push(...batchTxs);
      } catch (err: any) {
        console.error(`[AI Vision Batched] Batch ${batchNum} error: ${err.message}`);
        // Continue with other batches even if one fails
      }
    }

    // Deduplicate: if a transaction appears at the boundary between batches
    // (same date + same amount + same description), keep only the first
    const deduplicated: typeof allTransactions = [];
    const seen = new Set<string>();
    for (const tx of allTransactions) {
      const key = `${tx.date}|${tx.amount_cents}|${tx.description?.slice(0, 30)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(tx);
      }
    }

    console.log(
      `[AI Vision Batched] Total: ${allTransactions.length} raw, ${deduplicated.length} after dedup`,
    );
    return { transactions: deduplicated };
  }

  async categorizeTransaction(
    description: string,
    amount: number,
    model?: string,
  ): Promise<{ category: string; gst: boolean; notes: string }> {
    console.log(`[AI Reasoning] Categorizing: ${description} ($${amount})`);
    const modelId = model || 'google/gemini-3-flash-preview';

    const prompt = `
      You are an Australian Tax Expert. 
      Categorize this bank transaction for a generic business.
      Description: "${description}"
      Amount: ${amount} cents
      
      Return JSON:
      {
        "category": "string (e.g. 'Office Supplies', 'Travel', 'Meals', 'Utilities', 'Professional Fees', 'Uncategorized')",
        "gst": boolean, // true if GST is likely included (10%)
        "notes": "short reasoning"
      }
    `;

    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content;
      return JSON.parse(
        raw || '{"category": "Uncategorized", "gst": false, "notes": "Failed to parse"}',
      );
    } catch (err) {
      console.error('[AI Reasoning Error]', err);
      return { category: 'Uncategorized', gst: false, notes: 'Error calling AI' };
    }
  }

  async categorizeTransactionsBatch(
    txs: Array<{ description: string; amount_cents: number }>,
    model?: string,
  ): Promise<Array<{ category: string; gst: boolean; notes: string }>> {
    console.log(`[AI Reasoning] Batch Categorizing ${txs.length} transactions...`);
    const modelId = model || 'google/gemini-3-flash-preview';

    const prompt = `
You are an Australian Tax Expert. 
Categorize these bank transactions for a generic business.

Transactions:
${JSON.stringify(txs, null, 2)}

Return a JSON object with a "categorizations" array of objects:
{
  "categorizations": [
    {
      "category": "string (e.g. 'Office Supplies', 'Travel', 'Meals', 'Utilities', 'Professional Fees')",
      "gst": boolean,
      "notes": "short reasoning"
    }
  ]
}
Matches the indices of the input array.
`;

    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content;
      const parsed = JSON.parse(raw || '{"categorizations": []}');
      return parsed.categorizations;
    } catch (err) {
      console.error('[AI Batch Error]', err);
      return txs.map(() => ({ category: 'Uncategorized', gst: false, notes: 'Error' }));
    }
  }

  async generateInsight(query: string, context: unknown, model?: string): Promise<string> {
    console.log(`[AI Insight] Query: ${query}`);
    const modelId = model || 'google/gemini-3-flash-preview';

    const prompt = `
      You are a helpful financial assistant.
      User Query: "${query}"

      Context (Recent Transactions):
      ${JSON.stringify(context, null, 2)}

      Provide a helpful, concise answer in markdown format.
      Use the context to answer specific questions about spending, balances, or categories.
    `;

    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.choices[0].message.content || "I couldn't generate an answer.";
    } catch (err) {
      console.error('[AI Insight Error]', err);
      return 'Sorry, I encountered an error generating insights.';
    }
  }

  async parseStatementText(
    pdfText: string,
    model?: string,
  ): Promise<{
    transactions: Array<{
      date: string;
      description: string;
      amount_cents: number;
      balance_cents?: number;
    }>;
  }> {
    console.log(`[AI Parse] Parsing statement text (${pdfText.length} chars)...`);
    const modelId = model || 'google/gemini-3-flash-preview';

    const prompt = `
You are an expert financial OCR and parsing machine.
Analyze this bank statement text extracted from a PDF.
Extract ALL transactions you can find.

Return strict JSON with this schema:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "transaction description text",
      "amount_cents": 1234,
      "balance_cents": 5678
    }
  ]
}

Rules:
- amount_cents should be an INTEGER representing cents (e.g., $12.34 = 1234)
- Use NEGATIVE values for debits/withdrawals, POSITIVE for credits/deposits
- balance_cents is optional, include if available
- Parse dates to YYYY-MM-DD format
- Clean up description text (remove extra whitespace, line breaks)
- If you cannot parse a field, make your best guess or omit it
- Return ONLY valid JSON, no other text

Bank Statement Text:
${pdfText}
`;

    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content;
      const parsed = JSON.parse(raw || '{"transactions": []}');
      console.log(
        `[AI Parse] Successfully parsed ${parsed.transactions?.length || 0} transactions`,
      );
      return parsed;
    } catch (err) {
      console.error('[AI Parse Error]', err);
      return { transactions: [] };
    }
  }

  async extractAccountInfo(
    pdfText: string,
    model?: string,
  ): Promise<{
    accountNumber: string | null;
    accountNumberMasked: string | null;
    bankName: string | null;
    accountType: string | null;
    statementPeriod: { start: string; end: string } | null;
    openingBalance: number | null;
    closingBalance: number | null;
    confidence: number;
  }> {
    console.log(`[AI Account] Extracting account info from statement...`);
    const modelId = model || 'google/gemini-3-flash-preview';

    const prompt = `
You are an expert at reading bank statements.
Extract the account information from this bank statement text.

Return strict JSON with this schema:
{
  "account_number": "the full account number if visible, or null",
  "account_number_masked": "masked version like XXX-XXX-1234 showing last 4 digits",
  "bank_name": "name of the bank (e.g., 'Commonwealth Bank', 'ANZ', 'Westpac', 'NAB')",
  "account_type": "one of: 'checking', 'savings', 'credit_card', 'loan', 'investment', 'unknown'",
  "statement_period": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  },
  "opening_balance_cents": integer or null,
  "closing_balance_cents": integer or null,
  "confidence": 0.0 to 1.0 (how confident you are in this extraction)
}

Rules:
- Look for BSB, account numbers, card numbers
- For credit cards, extract the card number (masked is fine)
- Detect the bank from logos, headers, or formatting
- Extract statement period dates
- Balance amounts should be in cents (e.g., $1,234.56 = 123456)
- Return ONLY valid JSON

Bank Statement Text:
${pdfText.slice(0, 8000)}
`;

    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content;
      const parsed = JSON.parse(raw || '{}');

      return {
        accountNumber: parsed.account_number || null,
        accountNumberMasked: parsed.account_number_masked || null,
        bankName: parsed.bank_name || null,
        accountType: parsed.account_type || null,
        statementPeriod: parsed.statement_period || null,
        openingBalance: parsed.opening_balance_cents ?? null,
        closingBalance: parsed.closing_balance_cents ?? null,
        confidence: parsed.confidence || 0.5,
      };
    } catch (err) {
      console.error('[AI Account Error]', err);
      return {
        accountNumber: null,
        accountNumberMasked: null,
        bankName: null,
        accountType: null,
        statementPeriod: null,
        openingBalance: null,
        closingBalance: null,
        confidence: 0,
      };
    }
  }

  async categorizeWithMemory(
    transactions: Array<{ description: string; amount_cents: number }>,
    merchantMemory: Array<{ pattern: string; category: string; gst: boolean }>,
    model?: string,
  ): Promise<
    Array<{
      category: string;
      gst: boolean;
      notes: string;
      confidence: number;
      merchantNormalized: string;
      needsReview: boolean;
    }>
  > {
    console.log(
      `[AI Categorize] Categorizing ${transactions.length} transactions with ${merchantMemory.length} memory entries...`,
    );
    const modelId = model || 'google/gemini-3-flash-preview';

    const prompt = `
You are an Australian Tax Expert with memory of previous categorizations.

LEARNED MERCHANT PATTERNS (use these for matching):
${JSON.stringify(merchantMemory, null, 2)}

NEW TRANSACTIONS TO CATEGORIZE:
${JSON.stringify(transactions, null, 2)}

For each transaction:
1. First check if the description matches any learned merchant pattern
2. If matched, use the learned category
3. If not matched or unclear, make your best guess but mark for review
4. Normalize the merchant name for future matching

Return JSON:
{
  "categorizations": [
    {
      "category": "string",
      "gst": boolean,
      "notes": "reasoning",
      "confidence": 0.0 to 1.0,
      "merchant_normalized": "normalized merchant name for pattern matching",
      "needs_review": boolean (true if confidence < 0.7 or no memory match)
    }
  ]
}
`;

    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content;
      const parsed = JSON.parse(raw || '{"categorizations": []}') as {
        categorizations: {
          category?: string;
          gst?: boolean;
          notes?: string;
          confidence?: number;
          merchant_normalized?: string;
          needs_review?: boolean;
        }[];
      };

      return (parsed.categorizations || []).map((c) => ({
        category: c.category || 'Uncategorized',
        gst: c.gst || false,
        notes: c.notes || '',
        confidence: c.confidence || 0.5,
        merchantNormalized: c.merchant_normalized || '',
        needsReview: c.needs_review ?? true,
      }));
    } catch (err) {
      console.error('[AI Categorize Error]', err);
      return transactions.map(() => ({
        category: 'Uncategorized',
        gst: false,
        notes: 'Error',
        confidence: 0,
        merchantNormalized: '',
        needsReview: true,
      }));
    }
  }

  async detectTransfers(
    transactions: Array<{
      id: string;
      date: string;
      description: string;
      amount_cents: number;
      accountId?: string;
    }>,
    model?: string,
  ): Promise<
    Array<{
      sourceTransactionId: string;
      destinationTransactionId: string;
      confidence: number;
      reasoning: string;
    }>
  > {
    console.log(`[AI Transfer] Detecting transfers among ${transactions.length} transactions...`);
    const modelId = model || 'google/gemini-3-flash-preview';

    const prompt = `
Analyze these transactions from multiple bank accounts to detect internal transfers.
A transfer is when money moves from one account to another - it appears as a debit in one account and a credit in another.

TRANSACTIONS:
${JSON.stringify(transactions, null, 2)}

Look for:
1. Matching amounts (one negative, one positive) on same or adjacent dates
2. Descriptions mentioning "transfer", "TFR", "internal", account numbers
3. Transactions between different accountIds

Return JSON:
{
  "transfers": [
    {
      "source_transaction_id": "id of the debit/outgoing transaction",
      "destination_transaction_id": "id of the credit/incoming transaction",
      "confidence": 0.0 to 1.0,
      "reasoning": "why these are linked"
    }
  ]
}

Only include transfers you're reasonably confident about (> 0.6).
`;

    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content;
      const parsed = JSON.parse(raw || '{"transfers": []}') as {
        transfers: {
          source_transaction_id?: string;
          destination_transaction_id?: string;
          confidence?: number;
          reasoning?: string;
        }[];
      };

      return (parsed.transfers || []).map((t) => ({
        sourceTransactionId: t.source_transaction_id,
        destinationTransactionId: t.destination_transaction_id,
        confidence: t.confidence || 0.5,
        reasoning: t.reasoning || '',
      }));
    } catch (err) {
      console.error('[AI Transfer Error]', err);
      return [];
    }
  }

  async analyzeDebtPayoff(
    accounts: Array<{
      id: string;
      name: string;
      type: string;
      balance: number;
      interestRate: number;
      minimumPayment: number;
    }>,
    monthlyBudget: number,
    model?: string,
  ): Promise<{
    aggressive: DebtStrategy;
    moderate: DebtStrategy;
    minimum: DebtStrategy;
  }> {
    console.log(`[AI Debt] Analyzing debt payoff for ${accounts.length} accounts...`);
    const modelId = model || 'google/gemini-3-flash-preview';

    const prompt = `
You are a financial advisor calculating debt payoff strategies.

ACCOUNTS WITH DEBT:
${JSON.stringify(accounts, null, 2)}

AVAILABLE MONTHLY BUDGET FOR EXTRA PAYMENTS: ${monthlyBudget} cents

Calculate three strategies:

1. AGGRESSIVE: Pay off debt as fast as possible
   - Use debt avalanche (highest interest first) or snowball (smallest balance first)
   - Put all extra budget toward debt

2. MODERATE: Balanced approach
   - Pay more than minimums but keep some savings buffer
   - 70% of extra budget to debt, 30% to savings

3. MINIMUM: Pay only minimum payments
   - Just the required minimum payments
   - Maximum time, maximum interest

For each strategy, calculate:
- Total months to pay off all debt
- Total interest paid over life of debt
- Monthly payment breakdown per account
- Month-by-month projection (first 24 months)

Return JSON:
{
  "aggressive": {
    "total_months": integer,
    "total_interest_cents": integer,
    "total_paid_cents": integer,
    "monthly_payments": [{"account_id": "...", "payment_cents": ...}],
    "monthly_breakdown": [{"month": 1, "balances": {"account_id": balance_cents}, "interest_paid": cents}]
  },
  "moderate": { same structure },
  "minimum": { same structure }
}
`;

    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content;
      const parsed = JSON.parse(raw || '{}') as {
        aggressive?: {
          total_months?: number;
          total_interest_cents?: number;
          total_paid_cents?: number;
          monthly_payments?: Array<{ account_id: string; payment_cents: number }>;
          monthly_breakdown?: Array<{
            month: number;
            balances: Record<string, number>;
            interest_paid: number;
          }>;
        };
        moderate?: {
          total_months?: number;
          total_interest_cents?: number;
          total_paid_cents?: number;
          monthly_payments?: Array<{ account_id: string; payment_cents: number }>;
          monthly_breakdown?: Array<{
            month: number;
            balances: Record<string, number>;
            interest_paid: number;
          }>;
        };
        minimum?: {
          total_months?: number;
          total_interest_cents?: number;
          total_paid_cents?: number;
          monthly_payments?: Array<{ account_id: string; payment_cents: number }>;
          monthly_breakdown?: Array<{
            month: number;
            balances: Record<string, number>;
            interest_paid: number;
          }>;
        };
      };

      const mapStrategy = (s: NonNullable<typeof parsed.aggressive>): DebtStrategy => ({
        totalMonths: s?.total_months || 0,
        totalInterestCents: s?.total_interest_cents || 0,
        totalPaidCents: s?.total_paid_cents || 0,
        monthlyPayments: s?.monthly_payments || [],
        monthlyBreakdown: s?.monthly_breakdown || [],
      });

      return {
        aggressive: mapStrategy(parsed.aggressive),
        moderate: mapStrategy(parsed.moderate),
        minimum: mapStrategy(parsed.minimum),
      };
    } catch (err) {
      console.error('[AI Debt Error]', err);
      const empty: DebtStrategy = {
        totalMonths: 0,
        totalInterestCents: 0,
        totalPaidCents: 0,
        monthlyPayments: [],
        monthlyBreakdown: [],
      };
      return { aggressive: empty, moderate: empty, minimum: empty };
    }
  }
}

interface DebtStrategy {
  totalMonths: number;
  totalInterestCents: number;
  totalPaidCents: number;
  monthlyPayments: Array<{ account_id: string; payment_cents: number }>;
  monthlyBreakdown: Array<{
    month: number;
    balances: Record<string, number>;
    interest_paid: number;
  }>;
}

export const aiService = new AIService();
