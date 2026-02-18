/**
 * Pipeline stage: Claude agent path — insert transactions, index, and finalize.
 */
import { db, statements, transactions, pendingCategorization } from '../../schema.js';
import type { DbInstance } from '../../db/queries/types.js';
import { ragService } from '../rag.js';
import { accountService } from '../accounts.js';
import { cogneeClient } from '../cognee_client.js';
import { enrichmentService } from '../enrichment.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { events } from '../../events.js';
import { logger } from '../../utils/logger.js';
import { computeTransactionHash } from './categorization.js';
import type { AccountDetectionResult, RawTransactionData, CategorizationResult } from './types.js';

/** Handle the Claude agent path: insert transactions, index, and finalize */
export async function handleAgentPathInsertion(
  rawData: RawTransactionData,
  categorizations: CategorizationResult[],
  statementId: string,
  userId: string | undefined,
  accountDetection: AccountDetectionResult,
  stmtFilename: string,
): Promise<void> {
  const allAgentInserts = rawData.transactions.map((tx, i: number) => {
    const aiCat = (categorizations && categorizations[i]) || {
      category: 'Uncategorized',
      gst: false,
      notes: 'Missing from batch',
      confidence: 0,
      merchantNormalized: '',
      needsReview: true,
    };
    return {
      id: crypto.randomUUID(),
      statementId,
      userId,
      accountId: accountDetection.accountId,
      date: tx.date,
      description: tx.description,
      amount: tx.amount_cents,
      balance: tx.balance_cents,
      category: aiCat.category,
      gstApplicable: aiCat.gst,
      aiReasoningNotes: aiCat.notes,
      confidenceScore: aiCat.confidence,
      merchantNormalized: aiCat.merchantNormalized || null,
      isTransfer: false,
      transactionHash: computeTransactionHash(
        tx.date,
        tx.description,
        tx.amount_cents,
        accountDetection.accountId,
      ),
    };
  });

  // Deduplicate agent path
  const toInsert: typeof allAgentInserts = [];
  for (const tx of allAgentInserts) {
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionHash, tx.transactionHash),
          eq(transactions.statementId, statementId),
        ),
      )
      .get();
    if (!existing) {
      toInsert.push(tx);
    } else {
      logger.info(
        `[Pipeline] Agent path: skipping duplicate ${tx.date} ${tx.description} ${tx.amount}`,
      );
    }
  }

  if (toInsert.length > 0) {
    await db.transaction(async (tx: DbInstance) => {
      await tx.insert(transactions).values(toInsert);

      const pendingItems: (typeof pendingCategorization.$inferInsert)[] = [];
      for (let i = 0; i < categorizations.length; i++) {
        const cat = categorizations[i];
        const t = toInsert[i];
        if (cat && cat.needsReview && cat.confidence < 0.7 && userId) {
          pendingItems.push({
            id: crypto.randomUUID(),
            userId,
            transactionId: t.id,
            suggestedCategory: t.category,
            suggestedConfidence: cat.confidence,
            aiReasoning: cat.notes || null,
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
        }
      }
      if (pendingItems.length > 0) {
        await tx.insert(pendingCategorization).values(pendingItems);
      }

      if (userId) {
        const highConf = categorizations.filter((c) => c.confidence >= 0.8 && c.merchantNormalized);
        if (highConf.length > 0) {
          await accountService.batchUpdateMerchantMemory(
            userId,
            highConf.map((cat) => ({
              merchantPattern: cat.merchantNormalized,
              merchantDisplayName: undefined,
              category: cat.category,
              gstApplicable: cat.gst,
              isUserConfirmed: false,
              createdAt: new Date().toISOString(),
            })),
          );
        }
      }
    });
  }

  if (accountDetection.accountId) {
    await accountService.linkStatementToAccount(statementId, accountDetection.accountId);
  }

  // Index in Cognee
  try {
    await ragService.indexTransactions(toInsert);
    await cogneeClient.addStatementData({
      id: statementId,
      filename: stmtFilename,
      bankName: accountDetection.detectedInfo.bankName || undefined,
      periodStart: rawData.transactions[0]?.date,
      periodEnd: rawData.transactions[rawData.transactions.length - 1]?.date,
    });
  } catch (ragErr) {
    logger.error({ err: ragErr }, '[Pipeline Cognee Error]');
  }

  // Run enrichment for uncategorized transactions
  const agentUncategorized = toInsert
    .filter((t) => !t.category || t.category === 'Uncategorized')
    .map((t) => t.id);
  if (agentUncategorized.length > 0 && userId) {
    try {
      await enrichmentService.enrichTransactions(agentUncategorized, userId);
    } catch (enrichErr: unknown) {
      const msg = enrichErr instanceof Error ? enrichErr.message : String(enrichErr);
      logger.warn(`[Pipeline] Agent path enrichment error: ${msg}`);
    }
  }

  const finalStatus = accountDetection.needsSetup ? 'NEEDS_ACCOUNT_SETUP' : 'COMPLETED';
  const sortedDates = rawData.transactions.map((t) => t.date).sort();

  await db
    .update(statements)
    .set({
      parsingStatus: finalStatus,
      aiModelUsed: 'claude-agent-orchestrator',
      periodStartDate: sortedDates[0] || null,
      periodEndDate: sortedDates[sortedDates.length - 1] || null,
      openingBalance: rawData.transactions[0]?.balance_cents ?? null,
      closingBalance: rawData.transactions[rawData.transactions.length - 1]?.balance_cents ?? null,
      transactionCount: rawData.transactions.length,
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

  // Emit typed events
  events.emitParsingComplete({
    statementId,
    transactionCount: toInsert.length,
    accountId: accountDetection.accountId,
    bankName: accountDetection.detectedInfo.bankName,
  });
  events.emit('update', { type: 'bas_updated', userId });
  events.emit('update', { type: 'tax_updated', userId });

  logger.info(`[Pipeline] Claude agent processing complete for ${statementId}`);
}
