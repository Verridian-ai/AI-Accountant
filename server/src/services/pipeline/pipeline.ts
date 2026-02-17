/**
 * Main pipeline orchestrator class that coordinates all processing stages.
 */
import { db, statements, userSettings } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { events } from '../../events.js';
import { logger } from '../../utils/logger.js';
import type { AccountDetectionResult, RawTransactionData } from './types.js';
import { extractPdfText } from './text-extraction.js';
import { detectAccountInfo, detectCreditCard } from './account-detection.js';
import { tryCreditCardParser, tryBankParser } from './bank-parser.js';
import { tryClaudeAgentParsing, tryLegacyAiParsing, runVisionVerification } from './ai-parsing.js';
import { handleAgentPathInsertion } from './agent-insertion.js';
import { finalizeStatement } from './pipeline-finalize.js';

export class PipelineService {
  async processStatement(statementId: string, filePath: string) {
    try {
      logger.info(`[Pipeline] Starting processing for ${statementId}`);

      const stmt = await db.select().from(statements).where(eq(statements.id, statementId)).get();
      const userId = stmt?.userId ?? undefined;

      let settings = userId
        ? await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get()
        : null;
      if (!settings && userId) {
        settings = {
          userId,
          modelParsingText: 'google/gemini-3-flash-preview',
          modelParsingVision: 'google/gemini-3-flash-preview',
          modelCategorization: 'google/gemini-3-flash-preview',
          modelChat: 'google/gemini-3-flash-preview',
          modelEmbedding: 'openai/text-embedding-3-large',
        };
        await db.insert(userSettings).values(settings);
      }

      await db
        .update(statements)
        .set({ parsingStatus: 'PROCESSING' })
        .where(eq(statements.id, statementId));
      events.emit('update', {
        type: 'statement_updated',
        id: statementId,
        status: 'PROCESSING',
        userId,
      });

      // 1. Read and parse PDF text content
      let pdfText = '';
      try {
        pdfText = await extractPdfText(filePath);
      } catch (pdfErr: unknown) {
        const errMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        logger.error({ err: pdfErr, filePath }, '[Pipeline PDF Error]');
        await db
          .update(statements)
          .set({
            parsingStatus: 'FAILED',
            errorType: 'PDF_READ_ERROR',
            errorMessage: errMsg || 'Failed to read PDF content.',
            errorDetails: JSON.stringify({ filename: stmt?.filename, originalError: errMsg }),
          })
          .where(eq(statements.id, statementId));
        events.emit('update', {
          type: 'statement_updated',
          id: statementId,
          status: 'FAILED',
          userId,
        });
        return;
      }

      // 2. Extract account information
      const accountDetection: AccountDetectionResult = await detectAccountInfo(
        pdfText,
        statementId,
        userId,
        settings?.modelParsingText,
      );
      const { isCreditCardStatement, isBusinessCreditCard } = await detectCreditCard(
        pdfText,
        accountDetection,
      );

      // 3. Try bank-specific regex parser first
      logger.info(`[Pipeline] Trying bank-specific parser...`);
      let rawData: RawTransactionData | undefined;

      if (isCreditCardStatement) {
        rawData = await tryCreditCardParser(pdfText, accountDetection);
      }
      if (!rawData || rawData.transactions.length === 0) {
        rawData = await tryBankParser(pdfText, accountDetection);
      }

      // 4. If regex parser didn't produce results, try AI parsing
      if (!rawData || rawData.transactions.length === 0) {
        logger.info(`[Pipeline] Sending to AI for parsing...`);

        const agentResult = await tryClaudeAgentParsing(
          pdfText,
          statementId,
          userId,
          accountDetection,
          stmt?.filename || 'unknown.pdf',
        );
        if (agentResult && agentResult.rawData.transactions.length > 0) {
          await handleAgentPathInsertion(
            agentResult.rawData,
            agentResult.categorizations,
            statementId,
            userId,
            accountDetection,
            stmt?.filename || 'unknown.pdf',
          );
          return;
        }

        try {
          rawData = await tryLegacyAiParsing(pdfText, settings?.modelParsingText);
        } catch (aiErr: unknown) {
          const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
          logger.error({ err: aiErr }, '[Pipeline AI Error]');
          await db
            .update(statements)
            .set({
              parsingStatus: 'FAILED',
              errorType: 'AI_PARSE_ERROR',
              errorMessage:
                'The AI was unable to find transactions in this document. Ensure it is a valid bank statement.',
              errorDetails: JSON.stringify({ rawError: errMsg }),
            })
            .where(eq(statements.id, statementId));
          events.emit('update', {
            type: 'statement_updated',
            id: statementId,
            status: 'FAILED',
            userId,
          });
          return;
        }
      }

      // 4b. Vision-based secondary verification
      rawData = (await runVisionVerification(
        filePath,
        statementId,
        rawData,
        settings?.modelParsingVision,
      )) as RawTransactionData;

      // 5. Finalize: categorize, insert, link, index, emit events
      await finalizeStatement(
        rawData,
        statementId,
        userId,
        accountDetection,
        isBusinessCreditCard,
        filePath,
        stmt?.filename || 'unknown.pdf',
        settings?.modelCategorization,
        settings?.modelParsingText,
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, '[Pipeline Critical Error]');
      await db
        .update(statements)
        .set({
          parsingStatus: 'FAILED',
          errorType: 'CRITICAL_ERROR',
          errorMessage: errMsg || 'An unexpected system error occurred during processing.',
        })
        .where(eq(statements.id, statementId));
      events.emit('update', { type: 'statement_updated', id: statementId, status: 'FAILED' });
      events.emitPipelineError({
        statementId,
        errorType: 'CRITICAL_ERROR',
        message: errMsg || 'An unexpected system error occurred during processing.',
      });
    }
  }
}

export const pipeline = new PipelineService();
