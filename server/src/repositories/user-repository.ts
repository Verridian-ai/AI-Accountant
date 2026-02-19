import { db } from '../schema.js';
import { users, userSettings } from '../schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { insert, update as typedUpdate } from '../db/typed-queries.js';
import {
  users_getById,
  users_findByUsername,
  userSettings_getByUserId,
} from '../db/prepared-statements.js';

/**
 * Repository for Users
 * Encapsulates all Drizzle ORM/SQL logic for 'users' and 'user_settings' tables.
 */
export class UserRepository {
  /**
   * Find a user by username.
   */
  async findByUsername(username: string): Promise<typeof users.$inferSelect | null> {
    const rows = await users_findByUsername.execute({ username });
    return rows[0] || null;
  }

  /**
   * Find a user by ID.
   */
  async getById(id: string): Promise<typeof users.$inferSelect | null> {
    const rows = await users_getById.execute({ id });
    return rows[0] || null;
  }

  /**
   * Create a new user.
   */
  async create(data: {
    username: string;
    passwordHash: string;
  }): Promise<typeof users.$inferSelect | null> {
    const id = randomUUID();
    // Set timestamps explicitly — `.default('CURRENT_TIMESTAMP')` in Drizzle SQLite-mode
    // inserts the literal string "CURRENT_TIMESTAMP" when proxied to PostgreSQL via wrapPgDb().
    const now = new Date().toISOString();
    await insert(db, users, {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return this.getById(id);
  }

  /**
   * Get user settings.
   */
  async getSettings(userId: string): Promise<typeof userSettings.$inferSelect | null> {
    const rows = await userSettings_getByUserId.execute({ userId });
    return rows[0] || null;
  }

  /**
   * Update or Create user settings.
   */
  async upsertSettings(
    userId: string,
    settings: Partial<typeof userSettings.$inferSelect>,
  ): Promise<typeof userSettings.$inferSelect | null> {
    const existing = await this.getSettings(userId);
    if (existing) {
      await typedUpdate(db, userSettings, settings, eq(userSettings.userId, userId));
    } else {
      await insert(db, userSettings, { userId, ...settings } as typeof userSettings.$inferInsert);
    }
    return this.getSettings(userId);
  }
}

export const userRepository = new UserRepository();
