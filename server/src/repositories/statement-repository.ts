import { db } from '../db/index.js';
import { statements, statementAccounts } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { selectOne, selectMany, insert, update as typedUpdate, deleteRows } from '../db/typed-queries.js';

/**
 * Repository for Statements
 * Encapsulates all Drizzle ORM/SQL logic for 'statements' table.
 */
export class StatementRepository {
  /**
   * Create a new statement record.
   */
  async create(data: {
    filename: string;
    hash: string;
    uploadDate: string;
    parsingStatus: string;
    userId: string;
  }): Promise<typeof statements.$inferSelect | null> {
    const id = randomUUID();
    await insert(db, statements, {
      id,
      ...data,
    });
    return this.getById(id);
  }

  /**
   * Get a statement by ID.
   */
  async getById(id: string): Promise<typeof statements.$inferSelect | null> {
    const result = await selectOne(db, statements, eq(statements.id, id));
    return result || null;
  }

  /**
   * Get all statements for a user.
   */
  async getByUserId(userId: string): Promise<Array<typeof statements.$inferSelect>> {
    const results: Array<typeof statements.$inferSelect> = await db
      .select()
      .from(statements)
      .where(eq(statements.userId, userId))
      .orderBy(desc(statements.uploadDate))
      .all();
    return results;
  }

  /**
   * Find a statement by hash (for duplicate detection).
   */
  async findByHash(hash: string): Promise<typeof statements.$inferSelect | null> {
    const result = await selectOne(db, statements, eq(statements.hash, hash));
    return result || null;
  }

  /**
   * Update a statement.
   */
  async update(id: string, data: Partial<typeof statements.$inferSelect>): Promise<typeof statements.$inferSelect | null> {
    await typedUpdate(db, statements, data, eq(statements.id, id));
    return this.getById(id);
  }

  /**
   * Delete a statement.
   */
  async delete(id: string): Promise<void> {
    await deleteRows(db, statements, eq(statements.id, id));
  }

  /**
   * Link a statement to an account.
   */
  async linkAccount(statementId: string, accountId: string): Promise<void> {
    await db.insert(statementAccounts).values({ statementId, accountId }).onConflictDoNothing();
  }
}

export const statementRepository = new StatementRepository();
