import OpenAI from 'openai';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';

dotenv.config({ path: '../env.local' });

export interface AIModelResponse {
    content: string;
    usage?: number;
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
        const baseURL = openrouterKey ? "https://openrouter.ai/api/v1" : undefined;

        if (!apiKey) {
            console.warn("No API Key found for AI Service!");
        }

        this.client = new OpenAI({
            apiKey: apiKey || 'dummy',
            baseURL: baseURL,
            dangerouslyAllowBrowser: false,
        });
    }

    async parseWithVision(imagePaths: string[], model: string = 'google/gemini-3-flash-preview'): Promise<any> {
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
            const contentImages = await Promise.all(imagePaths.map(async path => {
                const buffer = await readFile(path);
                const b64 = buffer.toString('base64');
                return {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${b64}`,
                        detail: 'high'
                    }
                } as any;
            }));

            const response = await this.client.chat.completions.create({
                model: modelId,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            ...contentImages
                        ],
                    },
                ],
                response_format: { type: "json_object" }
            });

            const raw = response.choices[0].message.content;
            return JSON.parse(raw || '{"transactions": []}');

        } catch (err) {
            console.error("[AI Vision Error]", err);
            throw err;
        }
    }

    async categorizeTransaction(description: string, amount: number, model?: string): Promise<{ category: string, gst: boolean, notes: string }> {
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
                response_format: { type: "json_object" }
            });

            const raw = response.choices[0].message.content;
            return JSON.parse(raw || '{"category": "Uncategorized", "gst": false, "notes": "Failed to parse"}');
        } catch (err) {
            console.error("[AI Reasoning Error]", err);
            return { category: 'Uncategorized', gst: false, notes: 'Error calling AI' };
        }
    }

    async categorizeTransactionsBatch(txs: Array<{ description: string, amount_cents: number }>, model?: string): Promise<Array<{ category: string, gst: boolean, notes: string }>> {
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
                response_format: { type: "json_object" }
            });

            const raw = response.choices[0].message.content;
            const parsed = JSON.parse(raw || '{"categorizations": []}');
            return parsed.categorizations;
        } catch (err) {
            console.error("[AI Batch Error]", err);
            return txs.map(() => ({ category: 'Uncategorized', gst: false, notes: 'Error' }));
        }
    }

    async generateInsight(query: string, context: any, model?: string): Promise<string> {
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
            console.error("[AI Insight Error]", err);
            return "Sorry, I encountered an error generating insights.";
        }
    }

    async parseStatementText(pdfText: string, model?: string): Promise<{ transactions: Array<{ date: string; description: string; amount_cents: number; balance_cents?: number }> }> {
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
                response_format: { type: "json_object" }
            });

            const raw = response.choices[0].message.content;
            const parsed = JSON.parse(raw || '{"transactions": []}');
            console.log(`[AI Parse] Successfully parsed ${parsed.transactions?.length || 0} transactions`);
            return parsed;
        } catch (err) {
            console.error("[AI Parse Error]", err);
            return { transactions: [] };
        }
    }
}

export const aiService = new AIService();
