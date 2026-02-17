import { db, transactions, transactionHistory } from '../schema.js';
import { eq, and, desc, gte, lte, like, sql, type SQL } from 'drizzle-orm';
import { selectOne, selectMany, insert, update as typedUpdate, deleteRows } from '../db/typed-queries.js';

export interface TransactionFilters {
  limit?: number;
  offset?: number;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  search?: string;
  userId: string;
}

export class TransactionRepository {
  async findMany(filters: TransactionFilters): Promise<{
    data: Array<typeof transactions.$inferSelect>;
    total: number;
  }> {
    const {
      limit = 100,
      offset = 0,
      accountId,
      startDate,
      endDate,
      category,
      search,
      userId,
    } = filters;

    const conditions: SQL[] = [eq(transactions.userId, userId)];

    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (startDate) conditions.push(gte(transactions.date, startDate));
    if (endDate) conditions.push(lte(transactions.date, endDate));
    if (category && category !== 'All') conditions.push(eq(transactions.category, category));
    if (search) conditions.push(like(transactions.description, `%${search}%`));

    const [result, countResult] = await Promise.all([
      db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.date))
        .limit(limit)
        .offset(offset)
        .all() as Promise<Array<typeof transactions.$inferSelect>>,
      db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(and(...conditions))
        .get() as Promise<{ count: number } | undefined>,
    ]);

    return { data: result, total: countResult?.count ?? 0 };
  }

  async findAll(filters: Omit<TransactionFilters, 'limit' | 'offset'>): Promise<Array<typeof transactions.$inferSelect>> {
    const { accountId, startDate, endDate, category, search, userId } = filters;
    const conditions: SQL[] = [eq(transactions.userId, userId)];

    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (startDate) conditions.push(gte(transactions.date, startDate));
    if (endDate) conditions.push(lte(transactions.date, endDate));
    if (category && category !== 'All') conditions.push(eq(transactions.category, category));
    if (search) conditions.push(like(transactions.description, `%${search}%`));

    const results: Array<typeof transactions.$inferSelect> = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date))
      .all();
    return results;
  }

  async findById(userId: string, transactionId: string): Promise<typeof transactions.$inferSelect | undefined> {
    return selectOne(
      db,
      transactions,
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    );
  }

  async update(
    userId: string,
    transactionId: string,
    data: Partial<typeof transactions.$inferInsert>
  ): Promise<void> {
    await typedUpdate(
      db,
      transactions,
      data,
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    );
  }

  async createMany(data: (typeof transactions.$inferInsert)[]): Promise<void> {
    await insert(db, transactions, data);
  }

  async delete(userId: string, transactionId: string): Promise<void> {
    await deleteRows(
      db,
      transactions,
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    );
  }

  async createHistory(data: typeof transactionHistory.$inferInsert): Promise<void> {
    await insert(db, transactionHistory, data);
  }

  async findByStatementId(statementId: string): Promise<Array<typeof transactions.$inferSelect>> {
    return selectMany(db, transactions, eq(transactions.statementId, statementId));
  }

  /**
   * Delete transactions by statement ID.
   */
  async deleteByStatementId(statementId: string): Promise<void> {
    await deleteRows(db, transactions, eq(transactions.statementId, statementId));
  }
}

export const transactionRepository = new TransactionRepository();
