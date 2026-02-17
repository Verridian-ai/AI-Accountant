import { db } from '../db/index.js';
import { users, userSettings } from '../schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { selectOne, insert, update as typedUpdate } from '../db/typed-queries.js';

/**
 * Repository for Users
 * Encapsulates all Drizzle ORM/SQL logic for 'users' and 'user_settings' tables.
 */
export class UserRepository {
  /**
   * Find a user by username.
   */
  async findByUsername(username: string): Promise<typeof users.$inferSelect | null> {
    const result = await selectOne(db, users, eq(users.username, username));
    return result || null;
  }

  /**
   * Find a user by ID.
   */
  async getById(id: string): Promise<typeof users.$inferSelect | null> {
    const result = await selectOne(db, users, eq(users.id, id));
    return result || null;
  }

  /**
   * Create a new user.
   */
  async create(data: { username: string; passwordHash: string }): Promise<typeof users.$inferSelect | null> {
    const id = randomUUID();
    await insert(db, users, {
      id,
      ...data,
    });
    return this.getById(id);
  }

  /**
   * Get user settings.
   */
  async getSettings(userId: string): Promise<typeof userSettings.$inferSelect | null> {
    const result = await selectOne(db, userSettings, eq(userSettings.userId, userId));
    return result || null;
  }

  /**
   * Update or Create user settings.
   */
  async upsertSettings(userId: string, settings: Partial<typeof userSettings.$inferSelect>): Promise<typeof userSettings.$inferSelect | null> {
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
