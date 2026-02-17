import OpenAI from 'openai';
import { logger } from '../../lib/logger.js';

/**
 * Mixin methods for AIService: statement text parsing and account info extraction.
 * These are standalone functions that accept an OpenAI client instance.
 */

export async function parseStatementText(
  client: OpenAI,
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
  logger.info(`[AI Parse] Parsing statement text (${pdfText.length} chars)...`);
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
    const response = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0].message.content;
    const parsed = JSON.parse(raw || '{"transactions": []}');
    logger.info(`[AI Parse] Successfully parsed ${parsed.transactions?.length || 0} transactions`);
    return parsed;
  } catch (err) {
    logger.error({ err: err }, '[AI Parse Error]');
    return { transactions: [] };
  }
}

export async function extractAccountInfo(
  client: OpenAI,
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
  logger.info(`[AI Account] Extracting account info from statement...`);
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
    const response = await client.chat.completions.create({
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
    logger.error({ err: err }, '[AI Account Error]');
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
