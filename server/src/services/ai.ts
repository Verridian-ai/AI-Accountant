import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';

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

    async parseWithVision(imagePaths: string[], model: VisionModel = 'gpt-5.2-vision'): Promise<any> {
        console.log(`[AI Vision] Processing ${imagePaths.length} images with ${model}...`);

        // Map internal model names to OpenRouter IDs
        let modelId = 'openai/gpt-4o'; // precise fallback
        if (model === 'gpt-5.2-vision') modelId = 'openai/gpt-5-vision'; // hypothetical
        if (model === 'gemini-3.0-pro') modelId = 'google/gemini-3.0-pro'; // hypothetical openrouter ID

        // For safety in this demo, fallback to known working models if 2026 models aren't real strings yet
        // modelId = 'openai/gpt-4o'; 

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
            const contentImages = imagePaths.map(path => {
                const b64 = fs.readFileSync(path).toString('base64');
                return {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${b64}`,
                        detail: 'high'
                    }
                } as any;
            });

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
            return JSON.parse(raw || '{}');

        } catch (err) {
            console.error("[AI Vision Error]", err);
            throw err;
        }
    }

    async categorizeTransaction(description: string, amount: number): Promise<{ category: string, gst: boolean, notes: string }> {
        console.log(`[AI Reasoning] Categorizing: ${description} ($${amount})`);

        // Choose a reasoning model (o3-mini is good for strict output)
        const modelId = 'openai/gpt-4o'; // Use 4o for speed, or o3-mini if available in 2026 via OpenRouter

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
    async generateInsight(query: string, context: any): Promise<string> {
        console.log(`[AI Insight] Query: ${query}`);
        const modelId = 'openai/gpt-4o';

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

    async parseStatementText(pdfText: string): Promise<{ transactions: Array<{ date: string; description: string; amount_cents: number; balance_cents?: number }> }> {
        console.log(`[AI Parse] Parsing statement text (${pdfText.length} chars)...`);
        const modelId = 'openai/gpt-4o';

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
