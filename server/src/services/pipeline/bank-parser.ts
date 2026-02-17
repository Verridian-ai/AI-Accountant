/**
 * Pipeline stage: Bank-specific regex parsing (primary parser).
 */
import { logger } from '../../utils/logger.js';
import { parserRegistry } from '../parsers/registry.js';
import { parseCreditCardStatement } from '../parsers/documents/credit-card/index.js';
import type { AccountDetectionResult, RawTransactionData } from './types.js';

/** Try credit card parser first if indicators were detected */
export async function tryCreditCardParser(
  pdfText: string,
  accountDetection: AccountDetectionResult,
): Promise<RawTransactionData | undefined> {
  try {
    const ccResult = await parseCreditCardStatement(pdfText);
    if (ccResult.success && ccResult.result && ccResult.result.transactions.length > 0) {
      logger.info(
        `[Pipeline] Credit card parser extracted ${ccResult.result.transactions.length} transactions`,
      );

      const rawData: RawTransactionData = {
        transactions: ccResult.result.transactions.map((tx) => ({
          date: tx.date,
          description: tx.description,
          amount_cents: tx.amount,
          balance_cents: tx.balance,
        })),
      };

      // Update account detection from credit card parser
      if (ccResult.result.accountInfo) {
        const info = ccResult.result.accountInfo;
        accountDetection.detectedInfo.bankName =
          ccResult.result.bankName || accountDetection.detectedInfo.bankName;
        accountDetection.detectedInfo.accountType = 'credit';
        if (info.cardNumber) {
          accountDetection.detectedInfo.accountNumber = info.cardNumber;
        }
        if (info.openingBalance !== undefined) {
          accountDetection.detectedInfo.openingBalance = info.openingBalance ?? null;
        }
        if (info.closingBalance !== undefined) {
          accountDetection.detectedInfo.closingBalance = info.closingBalance ?? null;
        }
      }

      logger.info(`[Pipeline] Credit card parser success — skipping regular bank parser`);
      return rawData;
    } else {
      logger.info(
        `[Pipeline] Credit card parser returned 0 transactions, trying regular bank parser`,
      );
    }
  } catch (ccErr: unknown) {
    const msg = ccErr instanceof Error ? ccErr.message : String(ccErr);
    logger.warn(`[Pipeline] Credit card parser error, trying regular bank parser: ${msg}`);
  }
  return undefined;
}

/** Try regular bank-specific regex parser */
export async function tryBankParser(
  pdfText: string,
  accountDetection: AccountDetectionResult,
): Promise<RawTransactionData | undefined> {
  try {
    const parseResult = await parserRegistry.parseStatement(pdfText, { fallbackToAI: false });
    if (parseResult.success && parseResult.transactions.length > 0) {
      logger.info(
        `[Pipeline] Bank parser (${parseResult.bankId}) extracted ${parseResult.transactions.length} transactions (confidence: ${parseResult.detectionConfidence.toFixed(2)})`,
      );

      // Map ParsedTransaction to pipeline format
      const rawData: RawTransactionData = {
        transactions: parseResult.transactions.map((tx) => ({
          date: tx.date,
          description: tx.description,
          amount_cents: tx.amount, // Already in cents from parser
          balance_cents: tx.balance, // Already in cents from parser
        })),
      };

      // Update account detection from parser results
      if (parseResult.accountInfo) {
        const info = parseResult.accountInfo;
        accountDetection.detectedInfo.bankName =
          parseResult.bankName || accountDetection.detectedInfo.bankName;
        accountDetection.detectedInfo.accountType =
          info.accountType || accountDetection.detectedInfo.accountType;
        if (info.accountNumber && info.accountNumber !== 'UNKNOWN') {
          accountDetection.detectedInfo.accountNumber = info.accountNumber;
        }
        if (info.openingBalance !== undefined) {
          accountDetection.detectedInfo.openingBalance = info.openingBalance;
        }
        if (info.closingBalance !== undefined) {
          accountDetection.detectedInfo.closingBalance = info.closingBalance;
        }
      }

      logger.info(`[Pipeline] Bank parser success — skipping AI text parsing`);
      return rawData;
    } else {
      logger.info(
        `[Pipeline] Bank parser returned 0 transactions (${parseResult.parseWarnings.join(', ')}), falling through to AI`,
      );
    }
  } catch (parserErr: unknown) {
    const msg = parserErr instanceof Error ? parserErr.message : String(parserErr);
    logger.warn(`[Pipeline] Bank parser error, falling through to AI: ${msg}`);
  }
  return undefined;
}
