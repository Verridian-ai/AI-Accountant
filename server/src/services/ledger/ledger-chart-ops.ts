/**
 * Ledger Chart of Accounts — standalone DB operations
 */

import { db, chartOfAccounts } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { STANDARD_CHART_OF_ACCOUNTS } from './chart-of-accounts.js';

export async function initializeChartOfAccounts(userId: string): Promise<void> {
  const now = new Date().toISOString();
  for (const account of STANDARD_CHART_OF_ACCOUNTS) {
    let parentAccountId: string | undefined;
    if (account.parent) {
      const parent = await db
        .select()
        .from(chartOfAccounts)
        .where(
          and(eq(chartOfAccounts.userId, userId), eq(chartOfAccounts.accountCode, account.parent)),
        )
        .limit(1);
      if (parent.length > 0) parentAccountId = parent[0].id;
    }
    await db
      .insert(chartOfAccounts)
      .values({
        id: crypto.randomUUID(),
        userId,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        normalBalance: account.normalBalance as 'debit' | 'credit',
        parentAccountId,
        taxCode: account.taxCode,
        basLabel: account.basLabel,
        isSystemAccount: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }
}

export async function getChartOfAccountsList(
  userId: string,
): Promise<(typeof chartOfAccounts.$inferSelect)[]> {
  return db
    .select()
    .from(chartOfAccounts)
    .where(eq(chartOfAccounts.userId, userId))
    .orderBy(chartOfAccounts.accountCode);
}

export async function findAccountByCode(
  userId: string,
  accountCode: string,
): Promise<typeof chartOfAccounts.$inferSelect | null> {
  const result = await db
    .select()
    .from(chartOfAccounts)
    .where(and(eq(chartOfAccounts.userId, userId), eq(chartOfAccounts.accountCode, accountCode)))
    .limit(1);
  return result[0] ?? null;
}
