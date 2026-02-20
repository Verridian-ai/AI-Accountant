import { db } from '../schema.js';
import { statements, statementAccounts } from '../schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { insert, update as typedUpdate, deleteRows } from '../db/typed-queries.js';
import {
  statements_getById,
  statements_findByHash,
  statements_getByUserId,
} from '../db/prepared-statements.js';

/**
 * Repository for Statements
 * Encapsulates all Drizzle ORM/SQL logic for 'statements' table.
 */
export class StatementRepository {
  /**
   * Create a new statement record.
   */
  async create(data: {
    id?: string;
    filename: string;
    hash: string;
    uploadDate: string;
    parsingStatus: string;
    userId: string;
  }): Promise<typeof statements.$inferSelect | null> {
    const id = data.id ?? randomUUID();
    const { id: _discardedId, ...rest } = data;
    await insert(db, statements, {
      id,
      ...rest,
    });
    return this.getById(id);
  }

  /**
   * Get a statement by ID.
   */
  async getById(id: string): Promise<typeof statements.$inferSelect | null> {
    const rows = await statements_getById.execute({ id });
    return rows[0] || null;
  }

  /**
   * Get all statements for a user, ordered by most recent upload.
   * Capped at 1000 rows — users with more than 1000 statements should use pagination.
   */
  async getByUserId(userId: string): Promise<Array<typeof statements.$inferSelect>> {
    return statements_getByUserId.execute({ userId });
  }

  /**
   * Find a statement by hash (for duplicate detection).
   */
  async findByHash(hash: string): Promise<typeof statements.$inferSelect | null> {
    const rows = await statements_findByHash.execute({ hash });
    return rows[0] || null;
  }

  /**
   * Update a statement.
   */
  async update(
    id: string,
    data: Partial<typeof statements.$inferSelect>,
  ): Promise<typeof statements.$inferSelect | null> {
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
