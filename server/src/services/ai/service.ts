import OpenAI from 'openai';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { logger } from '../../lib/logger.js';
import { config } from '../../lib/config.js';
import type { VisionParseResult } from './types.js';
import { parseStatementText, extractAccountInfo } from './parsing.js';
import { categorizeWithMemory, detectTransfers } from './analysis.js';
import { analyzeDebtPayoff } from './debt-analysis.js';
import { parseWithVisionBatched } from './vision-batch.js';

dotenv.config({ path: '../env.local' });

export class AIService {
  private client: OpenAI;

  constructor() {
    const openrouterKey = config.viteOpenrouterApiKey;
    const openaiKey = config.viteOpenaiApiKey;

    // Default to OpenRouter if available, otherwise direct OpenAI
    const apiKey = openrouterKey || openaiKey;
    const baseURL = openrouterKey ? 'https://openrouter.ai/api/v1' : undefined;

    if (!apiKey) {
      logger.warn('No API Key found for AI Service!');
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
    logger.info(`[AI Vision] Processing ${imagePaths.length} images with ${model}...`);
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
          } as OpenAI.Chat.Completions.ChatCompletionContentPart;
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
      logger.error({ err: err }, '[AI Vision Error]');
      throw err;
    }
  }

  async categorizeTransaction(
    description: string,
    amount: number,
    model?: string,
  ): Promise<{ category: string; gst: boolean; notes: string }> {
    logger.info(`[AI Reasoning] Categorizing: ${description} ($${amount})`);
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
      logger.error({ err: err }, '[AI Reasoning Error]');
      return { category: 'Uncategorized', gst: false, notes: 'Error calling AI' };
    }
  }

  async categorizeTransactionsBatch(
    txs: Array<{ description: string; amount_cents: number }>,
    model?: string,
  ): Promise<Array<{ category: string; gst: boolean; notes: string }>> {
    logger.info(`[AI Reasoning] Batch Categorizing ${txs.length} transactions...`);
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
      logger.error({ err: err }, '[AI Batch Error]');
      return txs.map(() => ({ category: 'Uncategorized', gst: false, notes: 'Error' }));
    }
  }

  async generateInsight(query: string, context: unknown, model?: string): Promise<string> {
    logger.info(`[AI Insight] Query: ${query}`);
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
      logger.error({ err: err }, '[AI Insight Error]');
      return 'Sorry, I encountered an error generating insights.';
    }
  }

  // Delegated methods — implementation in separate files for line-count compliance

  async parseWithVisionBatched(pdfPath: string, model?: string, pagesPerBatch?: number) {
    return parseWithVisionBatched(
      this.client,
      pdfPath,
      model ?? 'google/gemini-3-flash-preview',
      pagesPerBatch ?? 5,
    );
  }

  async parseStatementText(pdfText: string, model?: string) {
    return parseStatementText(this.client, pdfText, model);
  }

  async extractAccountInfo(pdfText: string, model?: string) {
    return extractAccountInfo(this.client, pdfText, model);
  }

  async categorizeWithMemory(
    transactions: Array<{ description: string; amount_cents: number }>,
    merchantMemory: Array<{ pattern: string; category: string; gst: boolean }>,
    model?: string,
  ) {
    return categorizeWithMemory(this.client, transactions, merchantMemory, model);
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
  ) {
    return detectTransfers(this.client, transactions, model);
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
  ) {
    return analyzeDebtPayoff(this.client, accounts, monthlyBudget, model);
  }
}

export const aiService = new AIService();
