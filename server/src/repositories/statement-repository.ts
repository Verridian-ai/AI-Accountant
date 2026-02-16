import { db } from '../db/index.js';
import { statements, statementAccounts } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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
  }) {
    const id = randomUUID();
    await db.insert(statements).values({
      id,
      ...data,
    });
    return this.getById(id);
  }

  /**
   * Get a statement by ID.
   */
  async getById(id: string) {
    const result = await db.select().from(statements).where(eq(statements.id, id)).get();
    return result || null;
  }

  /**
   * Get all statements for a user.
   */
  async getByUserId(userId: string) {
    return db
      .select()
      .from(statements)
      .where(eq(statements.userId, userId))
      .orderBy(desc(statements.uploadDate))
      .all();
  }

  /**
   * Find a statement by hash (for duplicate detection).
   */
  async findByHash(hash: string) {
    const result = await db.select().from(statements).where(eq(statements.hash, hash)).get();
    return result || null;
  }

  /**
   * Update a statement.
   */
  async update(id: string, data: Partial<typeof statements.$inferSelect>) {
    await db.update(statements).set(data).where(eq(statements.id, id));
    return this.getById(id);
  }

  /**
   * Delete a statement.
   */
  async delete(id: string) {
    await db.delete(statements).where(eq(statements.id, id));
  }

  /**
   * Link a statement to an account.
   */
  async linkAccount(statementId: string, accountId: string) {
    await db.insert(statementAccounts).values({ statementId, accountId }).onConflictDoNothing();
  }
}

export const statementRepository = new StatementRepository();
