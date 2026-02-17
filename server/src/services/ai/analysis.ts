import OpenAI from 'openai';
import { logger } from '../../lib/logger.js';

/**
 * AI-powered analysis functions: categorization with memory, transfer detection.
 * Standalone functions accepting an OpenAI client instance.
 */

export async function categorizeWithMemory(
  client: OpenAI,
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
  logger.info(
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
    const response = await client.chat.completions.create({
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
    logger.error({ err: err }, '[AI Categorize Error]');
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

export async function detectTransfers(
  client: OpenAI,
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
  logger.info(`[AI Transfer] Detecting transfers among ${transactions.length} transactions...`);
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
    const response = await client.chat.completions.create({
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
      sourceTransactionId: t.source_transaction_id ?? '',
      destinationTransactionId: t.destination_transaction_id ?? '',
      confidence: t.confidence || 0.5,
      reasoning: t.reasoning || '',
    }));
  } catch (err) {
    logger.error({ err: err }, '[AI Transfer Error]');
    return [];
  }
}
