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
    // Cap at 500 — a chart of accounts with >500 entries would be unusual
    const results: Array<typeof chartOfAccounts.$inferSelect> = await db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.userId, userId))
      .orderBy(chartOfAccounts.accountCode)
      .limit(500)
      .all();
    return results;
  }

  // --- Merchant Memory ---

  async findMerchantMemory(userId: string): Promise<Array<typeof merchantMemory.$inferSelect>> {
    // Cap at 1000 to prevent unbounded scans — merchant memory grows with usage
    const results: Array<typeof merchantMemory.$inferSelect> = await db
      .select()
      .from(merchantMemory)
      .where(eq(merchantMemory.userId, userId))
      .limit(1000)
      .all();
    return results;
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
    // Cap at 500 — callers should process in batches for large backlogs
    const results: Array<typeof pendingCategorization.$inferSelect> = await db
      .select()
      .from(pendingCategorization)
      .where(
        and(
          eq(pendingCategorization.userId, userId),
          eq(pendingCategorization.status, 'pending'),
        ),
      )
      .limit(500)
      .all();
    return results;
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
    // Cap at 1000 — transfer links grow linearly with transaction count
    const results: Array<typeof transferLinks.$inferSelect> = await db
      .select()
      .from(transferLinks)
      .where(eq(transferLinks.userId, userId))
      .limit(1000)
      .all();
    return results;
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
    // Cap at 500 — return most recent 500 balance snapshots (ordered DESC)
    const results: Array<typeof accountBalanceHistory.$inferSelect> = await db
      .select()
      .from(accountBalanceHistory)
      .where(eq(accountBalanceHistory.accountId, accountId))
      .orderBy(desc(accountBalanceHistory.balanceDate))
      .limit(500)
      .all();
    return results;
  }

  async findReconciliationAlerts(
    userId: string,
    showResolved: boolean,
  ): Promise<Array<typeof reconciliationAlerts.$inferSelect>> {
    // Cap at 500 — unresolved alerts should be reviewed and cleared regularly
    const results: Array<typeof reconciliationAlerts.$inferSelect> = await db
      .select()
      .from(reconciliationAlerts)
      .where(
        and(
          eq(reconciliationAlerts.userId, userId),
          showResolved ? undefined : eq(reconciliationAlerts.isResolved, false),
        ),
      )
      .orderBy(desc(reconciliationAlerts.createdAt))
      .limit(500)
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
