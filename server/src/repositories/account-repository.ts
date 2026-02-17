import {
  db,
  accounts,
  accountBalanceHistory,
  merchantMemory,
  transferLinks,
  reconciliationAlerts,
  pendingCategorization,
  chartOfAccounts,
  statementAccounts,
} from '../schema.js';
import { eq, and, desc, like, type SQL } from 'drizzle-orm';
import { selectOne, selectMany, insert, update as typedUpdate, deleteRows } from '../db/typed-queries.js';

export interface AccountFilters {
  ownershipTag?: string;
  type?: string;
  search?: string;
}

export class AccountRepository {
  // --- Accounts ---

  async findByHash(userId: string, hash: string): Promise<typeof accounts.$inferSelect | undefined> {
    return selectOne(db, accounts, and(eq(accounts.userId, userId), eq(accounts.accountNumberHash, hash)));
  }

  async findAll(userId: string, filters?: AccountFilters): Promise<Array<typeof accounts.$inferSelect>> {
    const conditions: SQL[] = [eq(accounts.userId, userId)];

    if (filters?.ownershipTag) {
      conditions.push(eq(accounts.ownershipTag, filters.ownershipTag));
    }
    if (filters?.type) {
      conditions.push(eq(accounts.accountType, filters.type));
    }
    if (filters?.search) {
      conditions.push(like(accounts.accountName, `%${filters.search}%`));
    }

    return selectMany(db, accounts, and(...conditions));
  }

  async findById(userId: string, accountId: string): Promise<typeof accounts.$inferSelect | undefined> {
    return selectOne(db, accounts, and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  }

  async create(data: typeof accounts.$inferInsert): Promise<void> {
    await insert(db, accounts, data);
  }

  async update(userId: string, accountId: string, data: Partial<typeof accounts.$inferInsert>): Promise<void> {
    await typedUpdate(
      db,
      accounts,
      data,
      and(eq(accounts.id, accountId), eq(accounts.userId, userId))
    );
  }

  async updateBalance(accountId: string, newBalance: number): Promise<void> {
    await typedUpdate(db, accounts, { currentBalance: newBalance }, eq(accounts.id, accountId));
  }

  async delete(userId: string, accountId: string): Promise<void> {
    await deleteRows(db, accounts, and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  }

  async linkStatement(statementId: string, accountId: string): Promise<void> {
    // For onConflictDoNothing, we need to use the raw API
    await db.insert(statementAccounts).values({ statementId, accountId }).onConflictDoNothing();
  }

  async getChartOfAccounts(userId: string): Promise<Array<typeof chartOfAccounts.$inferSelect>> {
    // For queries with ORDER BY, use raw db API with explicit typing
    const results: Array<typeof chartOfAccounts.$inferSelect> = await db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.userId, userId))
      .orderBy(chartOfAccounts.accountCode)
      .all();
    return results;
  }

  // --- Merchant Memory ---

  async findMerchantMemory(userId: string): Promise<Array<typeof merchantMemory.$inferSelect>> {
    return selectMany(db, merchantMemory, eq(merchantMemory.userId, userId));
  }

  async findMerchantMemoryByPattern(userId: string, pattern: string): Promise<typeof merchantMemory.$inferSelect | undefined> {
    return selectOne(
      db,
      merchantMemory,
      and(eq(merchantMemory.userId, userId), eq(merchantMemory.merchantPattern, pattern))
    );
  }

  async findMerchantMemoryById(userId: string, id: string): Promise<typeof merchantMemory.$inferSelect | undefined> {
    return selectOne(
      db,
      merchantMemory,
      and(eq(merchantMemory.id, id), eq(merchantMemory.userId, userId))
    );
  }

  async createMerchantMemory(data: typeof merchantMemory.$inferInsert): Promise<void> {
    await insert(db, merchantMemory, data);
  }

  async updateMerchantMemory(id: string, data: Partial<typeof merchantMemory.$inferInsert>): Promise<void> {
    await typedUpdate(db, merchantMemory, data, eq(merchantMemory.id, id));
  }

  async deleteMerchantMemory(id: string): Promise<void> {
    await deleteRows(db, merchantMemory, eq(merchantMemory.id, id));
  }

  // --- Pending Categorization ---

  async findPendingCategorizations(userId: string): Promise<Array<typeof pendingCategorization.$inferSelect>> {
    return selectMany(
      db,
      pendingCategorization,
      and(
        eq(pendingCategorization.userId, userId),
        eq(pendingCategorization.status, 'pending')
      )
    );
  }

  async findPendingCategorizationById(userId: string, id: string): Promise<typeof pendingCategorization.$inferSelect | undefined> {
    return selectOne(
      db,
      pendingCategorization,
      and(eq(pendingCategorization.id, id), eq(pendingCategorization.userId, userId))
    );
  }

  async updatePendingCategorization(
    id: string,
    data: Partial<typeof pendingCategorization.$inferInsert>
  ): Promise<void> {
    await typedUpdate(db, pendingCategorization, data, eq(pendingCategorization.id, id));
  }

  // --- Transfers ---

  async findTransferLinks(userId: string): Promise<Array<typeof transferLinks.$inferSelect>> {
    return selectMany(db, transferLinks, eq(transferLinks.userId, userId));
  }

  async findTransferLinkById(userId: string, id: string): Promise<typeof transferLinks.$inferSelect | undefined> {
    return selectOne(
      db,
      transferLinks,
      and(eq(transferLinks.id, id), eq(transferLinks.userId, userId))
    );
  }

  async createTransferLink(data: typeof transferLinks.$inferInsert): Promise<void> {
    await insert(db, transferLinks, data);
  }

  async deleteTransferLink(id: string): Promise<void> {
    await deleteRows(db, transferLinks, eq(transferLinks.id, id));
  }

  // --- Balance History & Alerts ---

  async findBalanceHistory(accountId: string): Promise<Array<typeof accountBalanceHistory.$inferSelect>> {
    // For complex queries with ORDER BY, we use the raw db API but add explicit typing
    const results: Array<typeof accountBalanceHistory.$inferSelect> = await db
      .select()
      .from(accountBalanceHistory)
      .where(eq(accountBalanceHistory.accountId, accountId))
      .orderBy(desc(accountBalanceHistory.balanceDate))
      .all();
    return results;
  }

  async findReconciliationAlerts(userId: string, showResolved: boolean): Promise<Array<typeof reconciliationAlerts.$inferSelect>> {
    // For complex queries with conditional WHERE and ORDER BY, use raw db API with explicit typing
    const results: Array<typeof reconciliationAlerts.$inferSelect> = await db
      .select()
      .from(reconciliationAlerts)
      .where(
        and(
          eq(reconciliationAlerts.userId, userId),
          showResolved ? undefined : eq(reconciliationAlerts.isResolved, false)
        )
      )
      .orderBy(desc(reconciliationAlerts.createdAt))
      .all();
    return results;
  }

  async findReconciliationAlertById(userId: string, id: string): Promise<typeof reconciliationAlerts.$inferSelect | undefined> {
    return selectOne(
      db,
      reconciliationAlerts,
      and(eq(reconciliationAlerts.id, id), eq(reconciliationAlerts.userId, userId))
    );
  }

  async updateReconciliationAlert(
    id: string,
    data: Partial<typeof reconciliationAlerts.$inferInsert>
  ): Promise<void> {
    await typedUpdate(db, reconciliationAlerts, data, eq(reconciliationAlerts.id, id));
  }
}

export const accountRepository = new AccountRepository();
