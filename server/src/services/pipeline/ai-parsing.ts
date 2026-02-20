/**
 * Pipeline stage: AI text/vision parsing fallback + vision verification.
 */
import { db, statements } from '../../schema.js';
import { aiService } from '../ai.js';
import { accountService } from '../accounts.js';
import { eq } from 'drizzle-orm';
import { events } from '../../events.js';
import { AiParseError } from '../../errors.js';
import { logger } from '../../utils/logger.js';
import { orchestrator } from '../claude/orchestrator.js';
import { isClaudeAgentsEnabled } from '../claude/config.js';
import { withRetry } from './text-extraction.js';
import type { AccountDetectionResult, RawTransactionData, CategorizationResult } from './types.js';

/** Run Claude agent orchestrator for parsing + categorization (returns early if successful) */
export async function tryClaudeAgentParsing(
  pdfText: string,
  statementId: string,
  userId: string | undefined,
  accountDetection: AccountDetectionResult,
  stmtFilename: string,
): Promise<{ rawData: RawTransactionData; categorizations: CategorizationResult[] } | null> {
  if (!isClaudeAgentsEnabled()) return null;

  logger.info(`[Pipeline] Using Claude agent orchestrator`);
  try {
    const merchantMemoryData = userId ? await accountService.getMerchantMemory(userId) : [];
    const memoryPatterns = merchantMemoryData.map((m: Record<string, unknown>) => ({
      pattern: m.merchantPattern as string,
      category: m.category as string,
      gst: (m.gstApplicable as boolean) ?? false,
    }));

    // Orchestrator expects numeric ID — use deterministic hash of UUID
    let numericId = 0;
    for (let i = 0; i < statementId.length; i++) {
      numericId = ((numericId << 5) - numericId + statementId.charCodeAt(i)) | 0;
    }
    numericId = Math.abs(numericId) || 1;

    const agentResult = await orchestrator.processStatement(
      numericId,
      pdfText,
      stmtFilename,
      memoryPatterns,
    );

    // Map agent output to existing format
    const rawData: RawTransactionData = {
      transactions: agentResult.parsed.transactions.map((tx) => ({
        date: tx.date,
        description: tx.description,
        amount_cents: tx.amount,
        balance_cents: tx.balance,
      })),
    };

    // Map categorizations from agent output
    const categorizations: CategorizationResult[] = agentResult.categorized.results.map((r) => ({
      category: r.category,
      gst: r.gstCategory === 'gst_applicable' || r.gstCategory === 'taxable_10',
      notes: r.aiReasoningNotes,
      confidence: r.confidence,
      merchantNormalized: r.merchantKey || '',
      needsReview: r.confidence < 0.7,
    }));

    // Update account detection from agent parser output
    if (agentResult.parsed.accountInfo) {
      const info = agentResult.parsed.accountInfo;
      accountDetection.detectedInfo.accountNumber = info.accountNumber || null;
      accountDetection.detectedInfo.bankName = agentResult.parsed.bankId || null;
      accountDetection.detectedInfo.accountType = info.accountType || null;
      accountDetection.detectedInfo.openingBalance = info.openingBalance ?? null;
      accountDetection.detectedInfo.closingBalance = info.closingBalance ?? null;
    }

    if (rawData.transactions.length > 0) {
      logger.info(`[Pipeline] Claude agents extracted ${rawData.transactions.length} transactions`);
      return { rawData, categorizations };
    }
  } catch (agentErr: unknown) {
    const msg = agentErr instanceof Error ? agentErr.message : String(agentErr);
    logger.warn(`[Pipeline] Claude agent failed, falling back to legacy AI: ${msg}`);
  }
  return null;
}

/** Legacy AI text parsing fallback */
export async function tryLegacyAiParsing(
  pdfText: string,
  modelParsingText: string | undefined,
): Promise<RawTransactionData> {
  return await withRetry(
    async () => {
      const result = await aiService.parseStatementText(pdfText, modelParsingText);
      if (!result || !result.transactions) {
        throw new AiParseError('AI failed to return any transaction data from the text.');
      }
      return result;
    },
    3,
    2000,
    'AI Transaction Parsing',
  );
}

/** Vision-based secondary verification */
export async function runVisionVerification(
  filePath: string,
  statementId: string,
  rawData: RawTransactionData | undefined,
  modelParsingVision: string | undefined,
): Promise<RawTransactionData | undefined> {
  try {
    const visionModel = modelParsingVision || 'google/gemini-3-flash-preview';
    logger.info(`[Pipeline] Running vision-based secondary check with ${visionModel}...`);

    const visionResult = await aiService.parseWithVisionBatched(filePath, visionModel);
    const visionTxCount = visionResult.transactions?.length || 0;
    const primaryTxCount = rawData?.transactions?.length || 0;

    logger.info(
      `[Pipeline] Vision check: ${visionTxCount} transactions (primary: ${primaryTxCount})`,
    );

    if (primaryTxCount === 0 && visionTxCount > 0) {
      // Primary parser failed entirely — use vision results
      logger.info(
        `[Pipeline] Primary parser returned 0, using vision results (${visionTxCount} txs)`,
      );
      return { transactions: visionResult.transactions };
    } else if (primaryTxCount > 0 && visionTxCount > 0) {
      // Both have results — log discrepancy for review but trust primary
      const discrepancy = Math.abs(primaryTxCount - visionTxCount);
      const discrepancyPct = (discrepancy / Math.max(primaryTxCount, visionTxCount)) * 100;
      const needsReview = discrepancyPct > 10;
      if (discrepancyPct > 20) {
        logger.warn(
          `[Pipeline] Vision discrepancy: primary=${primaryTxCount}, vision=${visionTxCount} (${discrepancyPct.toFixed(1)}% diff) — investigate`,
        );
      } else {
        logger.info(
          `[Pipeline] Vision verification passed: counts within ${discrepancyPct.toFixed(1)}% tolerance`,
        );
      }

      // Store verification results on statement
      const visionVerification = JSON.stringify({
        primaryCount: primaryTxCount,
        visionCount: visionTxCount,
        discrepancyPct: Math.round(discrepancyPct * 10) / 10,
        needsReview,
        verifiedAt: new Date().toISOString(),
      });
      await db
        .update(statements)
        .set({ validationErrors: visionVerification })
        .where(eq(statements.id, statementId));

      // Emit typed vision verification event
      events.emitVisionVerification({
        statementId,
        confidence: Math.round((100 - discrepancyPct) * 10) / 1000,
        matches: Math.min(primaryTxCount, visionTxCount),
        discrepancies: discrepancy,
        needsReview,
      });
    }
  } catch (visionErr: unknown) {
    const msg = visionErr instanceof Error ? visionErr.message : String(visionErr);
    logger.warn(`[Pipeline] Vision secondary check failed (non-fatal): ${msg}`);
    // Vision is supplementary — don't block pipeline on vision failure
  }
  return rawData;
}
