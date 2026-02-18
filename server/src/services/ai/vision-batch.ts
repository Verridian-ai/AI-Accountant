import OpenAI from 'openai';
import { logger } from '../../lib/logger.js';

/**
 * Parse a PDF by rendering each page to an image and sending batches to a vision model.
 * Returns structured transaction data. Handles multi-page PDFs by batching pages.
 */
export async function parseWithVisionBatched(
  client: OpenAI,
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
  logger.info(`[AI Vision Batched] Rendering PDF pages from: ${pdfPath}`);
  const modelId = model || 'google/gemini-3-flash-preview';

  // Render all pages to PNG buffers (dynamic import to avoid DOMMatrix error in Node.js tests)
  const { pdf } = await import('pdf-to-img');
  const pageBuffers: Buffer[] = [];
  for await (const image of await pdf(pdfPath, { scale: 2.0 })) {
    pageBuffers.push(Buffer.from(image));
  }
  logger.info(`[AI Vision Batched] Rendered ${pageBuffers.length} pages`);

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

    logger.info(
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

      const response = await client.chat.completions.create({
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
      const parsed = JSON.parse(raw || '{"transactions": []}');
      const batchTxs = parsed.transactions || [];
      logger.info(
        `[AI Vision Batched] Batch ${batchNum} extracted ${batchTxs.length} transactions`,
      );
      allTransactions.push(...batchTxs);
    } catch (err: unknown) {
      logger.error(
        `[AI Vision Batched] Batch ${batchNum} error: ${err instanceof Error ? err.message : String(err)}`,
      );
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

  logger.info(
    `[AI Vision Batched] Total: ${allTransactions.length} raw, ${deduplicated.length} after dedup`,
  );
  return { transactions: deduplicated };
}
