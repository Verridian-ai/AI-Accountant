/**
 * Pipeline Finalization — Save transactions, link accounts, index in Cognee,
 * run enrichment, emit events, and update final statement status.
 */

import { db, statements } from '../../schema.js';
import { accountService } from '../accounts.js';
import { eq } from 'drizzle-orm';
import { events } from '../../events.js';
import { logger } from '../../utils/logger.js';
import type { AccountDetectionResult, RawTransactionData } from './types.js';
import { computeStatementMetadata } from './types.js';
import {
  categorizeTransactions,
  prepareTransactionInserts,
  insertTransactions,
  indexInCognee,
  runEnrichment,
} from './categorization.js';
import { detectTransfers } from './transfer-detection.js';

/** Finalize statement: categorize, insert, link, index, and update status. */
export async function finalizeStatement(
  rawData: RawTransactionData,
  statementId: string,
  userId: string | undefined,
  accountDetection: AccountDetectionResult,
  isBusinessCreditCard: boolean,
  filePath: string,
  filename: string,
  modelCategorization?: string,
  modelParsingText?: string,
): Promise<void> {
  if (rawData.transactions.length > 0) {
    logger.info(
      `[Pipeline] Extracted ${rawData.transactions.length} transactions. Categorizing with memory...`,
    );

    const categorizations = await categorizeTransactions(
      rawData.transactions,
      userId,
      modelCategorization,
    );

    const toInsert = await prepareTransactionInserts(
      rawData,
      categorizations,
      statementId,
      userId,
      accountDetection,
      isBusinessCreditCard,
    );

    await insertTransactions(toInsert, categorizations, userId);

    if (accountDetection.accountId) {
      await accountService.linkStatementToAccount(statementId, accountDetection.accountId);
    }

    await detectTransfers(toInsert, userId, accountDetection);

    await indexInCognee(toInsert, rawData, statementId, filename, accountDetection);

    await runEnrichment(toInsert, userId);

    events.emit('update', { type: 'bas_updated', userId });
    events.emit('update', { type: 'tax_updated', userId });

    events.emitParsingComplete({
      statementId,
      transactionCount: toInsert.length,
      accountId: accountDetection.accountId,
      bankName: accountDetection.detectedInfo.bankName,
    });

    const finalStatus = accountDetection.needsSetup ? 'NEEDS_ACCOUNT_SETUP' : 'COMPLETED';
    const metadata = computeStatementMetadata(rawData.transactions, accountDetection);

    await db
      .update(statements)
      .set({
        parsingStatus: finalStatus,
        aiModelUsed: modelParsingText || 'bank-regex-parser',
        ...metadata,
        isComplete: true,
      })
      .where(eq(statements.id, statementId));

    events.emit('update', {
      type: 'statement_updated',
      id: statementId,
      status: finalStatus,
      userId,
      accountDetection: accountDetection.needsSetup ? accountDetection : undefined,
    });

    logger.info(`[Pipeline] Processing complete for ${statementId} (status: ${finalStatus})`);
  } else {
    logger.warn(`[Pipeline] No transactions found in statement ${statementId}`);
    await db
      .update(statements)
      .set({
        parsingStatus: 'FAILED',
        errorType: 'EMPTY_STATEMENT',
        errorMessage:
          'No transactions were detected. Please check if this is a valid transaction statement page.',
      })
      .where(eq(statements.id, statementId));
    events.emit('update', {
      type: 'statement_updated',
      id: statementId,
      status: 'FAILED',
      userId,
    });
  }
}
