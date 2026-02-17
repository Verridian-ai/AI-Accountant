/**
 * Pipeline stage: Account information detection and setup.
 */
import { db, accounts } from '../../schema.js';
import { aiService } from '../ai.js';
import { accountService } from '../accounts.js';
import { eq } from 'drizzle-orm';
import { events } from '../../events.js';
import { logger } from '../../utils/logger.js';
import { parserRegistry } from '../parsers/registry.js';
import { hasCreditCardIndicators } from '../parsers/detector.js';
import { withRetry } from './text-extraction.js';
import type { AccountDetectionResult } from './types.js';

export interface CreditCardDetectionResult {
  isCreditCardStatement: boolean;
  isBusinessCreditCard: boolean;
}

/** Detect account info from PDF text, create/match accounts */
export async function detectAccountInfo(
  pdfText: string,
  statementId: string,
  userId: string | undefined,
  modelParsingText: string | undefined,
): Promise<AccountDetectionResult> {
  logger.info(`[Pipeline] Extracting account information...`);
  const accountDetection: AccountDetectionResult = {
    accountId: null,
    isNewAccount: false,
    needsSetup: false,
    detectedInfo: {
      accountNumber: null,
      accountNumberMasked: null,
      bankName: null,
      accountType: null,
      openingBalance: null,
      closingBalance: null,
    },
  };

  try {
    // Try parser's extractAccountInfo first (faster, no AI cost)
    let accountInfo: Record<string, unknown> | null = null;
    const bankDetections = parserRegistry.detectBank(pdfText);
    if (bankDetections.length > 0 && bankDetections[0].confidence >= 0.5) {
      const parser = parserRegistry.getParser(bankDetections[0].bankId);
      if (parser) {
        try {
          const parserAccountInfo = await parser.extractAccountInfo(pdfText);
          if (
            parserAccountInfo &&
            parserAccountInfo.accountNumber &&
            parserAccountInfo.accountNumber !== 'UNKNOWN'
          ) {
            logger.info(
              `[Pipeline] Parser extracted account info (bank: ${bankDetections[0].bankId})`,
            );
            accountInfo = parserAccountInfo as unknown as Record<string, unknown>;
          }
        } catch (parserAccErr: unknown) {
          const msg = parserAccErr instanceof Error ? parserAccErr.message : String(parserAccErr);
          logger.warn(`[Pipeline] Parser account info extraction failed: ${msg}`);
        }
      }
    }

    // Fall back to AI if parser didn't produce account info
    if (!accountInfo) {
      accountInfo = (await withRetry(
        () => aiService.extractAccountInfo(pdfText, modelParsingText),
        2,
        1000,
        'Account Info Extraction',
      )) as Record<string, unknown>;
    }

    accountDetection.detectedInfo = {
      accountNumber: accountInfo.accountNumber as string | null,
      accountNumberMasked: accountInfo.accountNumberMasked as string | null,
      bankName: accountInfo.bankName as string | null,
      accountType: accountInfo.accountType as string | null,
      openingBalance: accountInfo.openingBalance as number | null,
      closingBalance: accountInfo.closingBalance as number | null,
    };

    // Check if this account already exists
    if (accountInfo.accountNumber && userId) {
      const accountHash = accountService.hashAccountNumber(accountInfo.accountNumber as string);
      const existingAccount = await accountService.findAccountByHash(userId, accountHash);

      if (existingAccount) {
        accountDetection.accountId = existingAccount.id;
        accountDetection.isNewAccount = false;
        logger.info(`[Pipeline] Found existing account: ${existingAccount.accountName}`);

        // Update account balance if we have closing balance
        if (accountInfo.closingBalance !== null) {
          await accountService.updateAccountBalance(
            existingAccount.id,
            accountInfo.closingBalance as number,
          );
        }
      } else {
        // Auto-create account from detected information
        accountDetection.isNewAccount = true;
        logger.info(`[Pipeline] New account detected — auto-creating`);

        try {
          const accountType = (accountDetection.detectedInfo.accountType ||
            'transaction') as string;
          const bankName = (accountDetection.detectedInfo.bankName || 'Unknown Bank') as string;
          const accountName = `${bankName} ${accountType.charAt(0).toUpperCase() + accountType.slice(1)}`;

          const newAccount = await accountService.createAccount({
            userId,
            accountNumber: accountInfo.accountNumber as string,
            accountName,
            accountType,
            bankName,
          });

          // Update balance if we have closing balance info
          if (accountInfo.closingBalance !== null && accountInfo.closingBalance !== undefined) {
            await accountService.updateAccountBalance(
              newAccount.id,
              accountInfo.closingBalance as number,
            );
          }

          accountDetection.accountId = newAccount.id;
          accountDetection.needsSetup = false;
          logger.info(`[Pipeline] Auto-created account: ${newAccount.id} (${accountName})`);

          events.emit('update', {
            type: 'account_created',
            statementId,
            userId,
            accountId: newAccount.id,
            detectedInfo: accountDetection.detectedInfo,
          });
        } catch (createErr: unknown) {
          const msg = createErr instanceof Error ? createErr.message : String(createErr);
          logger.warn(`[Pipeline] Auto-create account failed, marking for manual setup: ${msg}`);
          accountDetection.needsSetup = true;

          events.emit('update', {
            type: 'account_setup_needed',
            statementId,
            userId,
            detectedInfo: accountDetection.detectedInfo,
          });
        }
      }
    }
  } catch (accErr) {
    logger.warn(
      { err: accErr },
      '[Pipeline Account Detection Error] Continuing without account info',
    );
    // Continue processing even if account detection fails
  }

  return accountDetection;
}

/** Detect if statement is a credit card and update account detection accordingly */
export async function detectCreditCard(
  pdfText: string,
  accountDetection: AccountDetectionResult,
): Promise<CreditCardDetectionResult> {
  let isCreditCardStatement = false;
  let isBusinessCreditCard = false;
  const ccIndicators = hasCreditCardIndicators(pdfText);
  if (ccIndicators.isLikely) {
    logger.info(
      `[Pipeline] Credit card indicators detected (score: ${ccIndicators.score.toFixed(2)}, patterns: ${ccIndicators.matchedPatterns.length})`,
    );
    isCreditCardStatement = true;
    // Update account type detection
    accountDetection.detectedInfo.accountType = 'credit';

    // Check if this is a business credit card (for GST auto-flagging)
    const businessKeywords =
      /business\s*(card|credit|account)|corporate\s*(card|credit)|company\s*(card|credit)/i;
    if (businessKeywords.test(pdfText)) {
      isBusinessCreditCard = true;
      logger.info(`[Pipeline] Business credit card detected — will auto-flag GST`);
    }

    // Update account with credit card info if we have an account
    if (accountDetection.accountId) {
      try {
        const ccLimitMatch = pdfText.match(/credit\s*limit[:\s]*\$?([\d,]+\.?\d*)/i);
        const ccMinPayMatch = pdfText.match(
          /minimum\s*(?:payment|amount\s*due)[:\s]*\$?([\d,]+\.?\d*)/i,
        );
        const updateData: Record<string, number> = {};
        if (ccLimitMatch) {
          updateData.creditLimit = Math.round(parseFloat(ccLimitMatch[1].replace(/,/g, '')) * 100);
        }
        if (ccMinPayMatch) {
          updateData.minimumPayment = Math.round(
            parseFloat(ccMinPayMatch[1].replace(/,/g, '')) * 100,
          );
        }
        if (Object.keys(updateData).length > 0) {
          await db
            .update(accounts)
            .set(updateData)
            .where(eq(accounts.id, accountDetection.accountId));
          logger.info(`[Pipeline] Updated credit card account with: ${JSON.stringify(updateData)}`);
        }
      } catch (ccUpdateErr: unknown) {
        const msg = ccUpdateErr instanceof Error ? ccUpdateErr.message : String(ccUpdateErr);
        logger.warn(`[Pipeline] Credit card info update failed: ${msg}`);
      }
    }
  }

  return { isCreditCardStatement, isBusinessCreditCard };
}
