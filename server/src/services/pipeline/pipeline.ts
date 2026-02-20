/**
 * Main pipeline orchestrator class that coordinates all processing stages.
 */
import { readFile } from 'fs/promises';
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
import { csvParser } from '../parsers/formats/csv-parser.js';
import { ofxParser } from '../parsers/formats/ofx-parser.js';
import { qifParser } from '../parsers/formats/qif-parser.js';

/** Supported non-PDF file extensions */
type NonPdfFormat = 'csv' | 'ofx' | 'qfx' | 'qif';

/** Detect file format from file path extension */
function detectFileFormat(filePath: string): 'pdf' | NonPdfFormat {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'csv') return 'csv';
  if (ext === 'ofx' || ext === 'qfx') return 'ofx';
  if (ext === 'qif') return 'qif';
  return 'pdf';
}

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

      // Detect file type and route to appropriate parser
      const format = detectFileFormat(filePath);
      if (format !== 'pdf') {
        await this.processNonPdfFile(
          format,
          filePath,
          statementId,
          userId,
          stmt?.filename ?? 'unknown',
          settings?.modelCategorization,
          settings?.modelParsingText,
        );
        return;
      }

      // === PDF processing path ===
      await this.processPdfFile(
        filePath,
        statementId,
        userId,
        stmt?.filename ?? 'unknown.pdf',
        settings,
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

  /** Process a non-PDF file (CSV, OFX, QIF) */
  private async processNonPdfFile(
    format: NonPdfFormat,
    filePath: string,
    statementId: string,
    userId: string | undefined,
    filename: string,
    modelCategorization?: string,
    modelParsingText?: string,
  ): Promise<void> {
    logger.info(`[Pipeline] Processing ${format.toUpperCase()} file: ${filePath}`);

    let fileContent: string;
    try {
      const buffer = await readFile(filePath);
      fileContent = buffer.toString('utf-8');
    } catch (readErr: unknown) {
      const errMsg = readErr instanceof Error ? readErr.message : String(readErr);
      logger.error({ err: readErr, filePath }, `[Pipeline] Failed to read ${format} file`);
      await db
        .update(statements)
        .set({
          parsingStatus: 'FAILED',
          errorType: 'PDF_READ_ERROR',
          errorMessage: `Failed to read ${format.toUpperCase()} file: ${errMsg}`,
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

    let rawData: RawTransactionData | undefined;
    let bankName: string | null = null;
    let accountNumber: string | null = null;

    try {
      if (format === 'csv') {
        const result = await csvParser.parse(fileContent);
        if (result.success && result.transactions.length > 0) {
          rawData = {
            transactions: result.transactions.map((t) => ({
              date: t.date,
              description: t.description,
              amount_cents: t.amount,
              balance_cents: t.balance,
            })),
          };
          bankName = result.bankName;
          accountNumber = result.accountNumber ?? null;
        } else {
          const errors = result.errors.join('; ') || 'No transactions found';
          logger.warn(`[Pipeline] CSV parse failed: ${errors}`);
        }
      } else if (format === 'ofx') {
        const result = await ofxParser.parse(fileContent);
        if (result.success && result.transactions.length > 0) {
          rawData = {
            transactions: result.transactions.map((t) => ({
              date: t.date,
              description: t.description,
              amount_cents: t.amount,
              balance_cents: t.balance,
            })),
          };
          bankName = result.bankId;
          accountNumber = result.accountNumber;
        } else {
          const errors = result.errors.join('; ') || 'No transactions found';
          logger.warn(`[Pipeline] OFX parse failed: ${errors}`);
        }
      } else if (format === 'qif') {
        const result = await qifParser.parse(fileContent);
        if (result.success && result.transactions.length > 0) {
          rawData = {
            transactions: result.transactions.map((t) => ({
              date: t.date,
              description: t.description,
              amount_cents: t.amount,
              balance_cents: t.balance,
            })),
          };
          bankName = null;
          accountNumber = null;
        } else {
          const errors = result.errors.join('; ') || 'No transactions found';
          logger.warn(`[Pipeline] QIF parse failed: ${errors}`);
        }
      }
    } catch (parseErr: unknown) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      logger.error({ err: parseErr }, `[Pipeline] ${format.toUpperCase()} parser threw`);
      await db
        .update(statements)
        .set({
          parsingStatus: 'FAILED',
          errorType: 'AI_PARSE_ERROR',
          errorMessage: `Failed to parse ${format.toUpperCase()} file: ${errMsg}`,
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

    if (!rawData || rawData.transactions.length === 0) {
      await db
        .update(statements)
        .set({
          parsingStatus: 'FAILED',
          errorType: 'EMPTY_STATEMENT',
          errorMessage: `No transactions found in ${format.toUpperCase()} file.`,
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

    logger.info(
      `[Pipeline] ${format.toUpperCase()} parsed: ${rawData.transactions.length} transactions`,
    );

    // Build a minimal AccountDetectionResult for non-PDF files
    const accountDetection: AccountDetectionResult = {
      accountId: null,
      isNewAccount: false,
      needsSetup: !accountNumber,
      detectedInfo: {
        accountNumber: accountNumber,
        accountNumberMasked: accountNumber ? `****${accountNumber.slice(-4)}` : null,
        bankName: bankName,
        accountType: null,
        openingBalance: null,
        closingBalance: null,
      },
    };

    // If we have an account number, try to resolve/create the account
    if (accountNumber && userId) {
      try {
        const resolved = await detectAccountInfo(
          `Bank: ${bankName ?? 'Unknown'}\nAccount: ${accountNumber}`,
          statementId,
          userId,
          undefined,
        );
        accountDetection.accountId = resolved.accountId;
        accountDetection.isNewAccount = resolved.isNewAccount;
        accountDetection.needsSetup = resolved.needsSetup;
      } catch (acctErr: unknown) {
        const msg = acctErr instanceof Error ? acctErr.message : String(acctErr);
        logger.warn(`[Pipeline] Account detection for ${format} failed (non-fatal): ${msg}`);
      }
    }

    await finalizeStatement(
      rawData,
      statementId,
      userId,
      accountDetection,
      false, // isBusinessCreditCard — can't detect from CSV/OFX/QIF
      filePath,
      filename,
      modelCategorization,
      modelParsingText,
    );
  }

  /** Process a PDF file through the full parsing pipeline */
  private async processPdfFile(
    filePath: string,
    statementId: string,
    userId: string | undefined,
    filename: string,
    settings: Record<string, unknown> | null,
  ): Promise<void> {
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
          errorDetails: JSON.stringify({ filename, originalError: errMsg }),
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
      settings?.modelParsingText as string | undefined,
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
        filename,
      );
      if (agentResult && agentResult.rawData.transactions.length > 0) {
        await handleAgentPathInsertion(
          agentResult.rawData,
          agentResult.categorizations,
          statementId,
          userId,
          accountDetection,
          filename,
        );
        return;
      }

      try {
        rawData = await tryLegacyAiParsing(
          pdfText,
          settings?.modelParsingText as string | undefined,
        );
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
      settings?.modelParsingVision as string | undefined,
    )) as RawTransactionData;

    // 5. Finalize: categorize, insert, link, index, emit events
    await finalizeStatement(
      rawData,
      statementId,
      userId,
      accountDetection,
      isBusinessCreditCard,
      filePath,
      filename,
      settings?.modelCategorization as string | undefined,
      settings?.modelParsingText as string | undefined,
    );
  }
}

export const pipeline = new PipelineService();
