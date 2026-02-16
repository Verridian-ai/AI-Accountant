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

export interface AccountFilters {
  ownershipTag?: string;
  type?: string;
  search?: string;
}

export class AccountRepository {
  // --- Accounts ---

  async findByHash(userId: string, hash: string) {
    return db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.accountNumberHash, hash)))
      .get();
  }

  async findAll(userId: string, filters?: AccountFilters) {
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

    return db
      .select()
      .from(accounts)
      .where(and(...conditions))
      .all();
  }

  async findById(userId: string, accountId: string) {
    return db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .get();
  }

  async create(data: typeof accounts.$inferInsert) {
    await db.insert(accounts).values(data);
  }

  async update(userId: string, accountId: string, data: Partial<typeof accounts.$inferInsert>) {
    await db
      .update(accounts)
      .set(data)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  }

  async updateBalance(accountId: string, newBalance: number) {
    await db.update(accounts).set({ currentBalance: newBalance }).where(eq(accounts.id, accountId));
  }

  async delete(userId: string, accountId: string) {
    await db.delete(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  }

  async linkStatement(statementId: string, accountId: string) {
    await db.insert(statementAccounts).values({ statementId, accountId }).onConflictDoNothing();
  }

  async getChartOfAccounts(userId: string) {
    return db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.userId, userId))
      .orderBy(chartOfAccounts.accountCode)
      .all();
  }

  // --- Merchant Memory ---

  async findMerchantMemory(userId: string) {
    return db.select().from(merchantMemory).where(eq(merchantMemory.userId, userId)).all();
  }

  async findMerchantMemoryByPattern(userId: string, pattern: string) {
    return db
      .select()
      .from(merchantMemory)
      .where(and(eq(merchantMemory.userId, userId), eq(merchantMemory.merchantPattern, pattern)))
      .get();
  }

  async findMerchantMemoryById(userId: string, id: string) {
    return db
      .select()
      .from(merchantMemory)
      .where(and(eq(merchantMemory.id, id), eq(merchantMemory.userId, userId)))
      .get();
  }

  async createMerchantMemory(data: typeof merchantMemory.$inferInsert) {
    await db.insert(merchantMemory).values(data);
  }

  async updateMerchantMemory(id: string, data: Partial<typeof merchantMemory.$inferInsert>) {
    await db.update(merchantMemory).set(data).where(eq(merchantMemory.id, id));
  }

  async deleteMerchantMemory(id: string) {
    await db.delete(merchantMemory).where(eq(merchantMemory.id, id));
  }

  // --- Pending Categorization ---

  async findPendingCategorizations(userId: string) {
    return (
      db
        .select()
        .from(pendingCategorization)
        // Note: Joining is usually done at repository level or service level.
        // Repository ideally returns domain objects.
        // But for simplicity, we return the raw rows and let service handle joins or simple queries.
        // However, the service joined with transactions.
        // We'll expose a method that returns the rows, but service might need to fetch transactions separately or we add a specific method.
        // Let's stick to returning rows here and let service handle logic, OR
        // we can use Drizzle's query builder to return joined data if needed.
        // For now, let's just return the pending categorizations table rows.
        // The service was doing a leftJoin.
        // We will define a method specifically for this.
        .where(
          and(
            eq(pendingCategorization.userId, userId),
            eq(pendingCategorization.status, 'pending'),
          ),
        )
        .all()
    );
  }

  async findPendingCategorizationById(userId: string, id: string) {
    return db
      .select()
      .from(pendingCategorization)
      .where(and(eq(pendingCategorization.id, id), eq(pendingCategorization.userId, userId)))
      .get();
  }

  async updatePendingCategorization(
    id: string,
    data: Partial<typeof pendingCategorization.$inferInsert>,
  ) {
    await db.update(pendingCategorization).set(data).where(eq(pendingCategorization.id, id));
  }

  // --- Transfers ---

  async findTransferLinks(userId: string) {
    return db.select().from(transferLinks).where(eq(transferLinks.userId, userId)).all();
  }

  async findTransferLinkById(userId: string, id: string) {
    return db
      .select()
      .from(transferLinks)
      .where(and(eq(transferLinks.id, id), eq(transferLinks.userId, userId)))
      .get();
  }

  async createTransferLink(data: typeof transferLinks.$inferInsert) {
    await db.insert(transferLinks).values(data);
  }

  async deleteTransferLink(id: string) {
    await db.delete(transferLinks).where(eq(transferLinks.id, id));
  }

  // --- Balance History & Alerts ---

  async findBalanceHistory(accountId: string) {
    return db
      .select()
      .from(accountBalanceHistory)
      .where(eq(accountBalanceHistory.accountId, accountId))
      .orderBy(desc(accountBalanceHistory.balanceDate))
      .all();
  }

  async findReconciliationAlerts(userId: string, showResolved: boolean) {
    return db
      .select()
      .from(reconciliationAlerts)
      .where(
        and(
          eq(reconciliationAlerts.userId, userId),
          showResolved ? undefined : eq(reconciliationAlerts.isResolved, false),
        ),
      )
      .orderBy(desc(reconciliationAlerts.createdAt))
      .all();
  }

  async findReconciliationAlertById(userId: string, id: string) {
    return db
      .select()
      .from(reconciliationAlerts)
      .where(and(eq(reconciliationAlerts.id, id), eq(reconciliationAlerts.userId, userId)))
      .get();
  }

  async updateReconciliationAlert(
    id: string,
    data: Partial<typeof reconciliationAlerts.$inferInsert>,
  ) {
    await db.update(reconciliationAlerts).set(data).where(eq(reconciliationAlerts.id, id));
  }
}

export const accountRepository = new AccountRepository();
