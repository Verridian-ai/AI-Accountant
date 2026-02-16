import { db, transactions, transactionHistory } from '../schema.js';
import { eq, and, desc, gte, lte, like, sql, type SQL } from 'drizzle-orm';

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
  async findMany(filters: TransactionFilters) {
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
        .all(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(and(...conditions))
        .get(),
    ]);

    return { data: result, total: countResult?.count ?? 0 };
  }

  async findAll(filters: Omit<TransactionFilters, 'limit' | 'offset'>) {
    const { accountId, startDate, endDate, category, search, userId } = filters;
    const conditions: SQL[] = [eq(transactions.userId, userId)];

    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (startDate) conditions.push(gte(transactions.date, startDate));
    if (endDate) conditions.push(lte(transactions.date, endDate));
    if (category && category !== 'All') conditions.push(eq(transactions.category, category));
    if (search) conditions.push(like(transactions.description, `%${search}%`));

    return db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date))
      .all();
  }

  async findById(userId: string, transactionId: string) {
    return db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .get();
  }

  async update(
    userId: string,
    transactionId: string,
    data: Partial<typeof transactions.$inferInsert>,
  ) {
    await db
      .update(transactions)
      .set(data)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  }

  async createMany(data: (typeof transactions.$inferInsert)[]) {
    await db.insert(transactions).values(data);
  }

  async delete(userId: string, transactionId: string) {
    await db
      .delete(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  }

  async createHistory(data: typeof transactionHistory.$inferInsert) {
    await db.insert(transactionHistory).values(data);
  }
  async findByStatementId(statementId: string) {
    return db.select().from(transactions).where(eq(transactions.statementId, statementId)).all();
  }

  /**
   * Delete transactions by statement ID.
   */
  async deleteByStatementId(statementId: string) {
    await db.delete(transactions).where(eq(transactions.statementId, statementId));
  }
}

export const transactionRepository = new TransactionRepository();
