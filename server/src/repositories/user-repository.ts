import { db } from '../db/index.js';
import { users, userSettings } from '../schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * Repository for Users
 * Encapsulates all Drizzle ORM/SQL logic for 'users' and 'user_settings' tables.
 */
export class UserRepository {
  /**
   * Find a user by username.
   */
  async findByUsername(username: string) {
    const result = await db.select().from(users).where(eq(users.username, username)).get();
    return result || null;
  }

  /**
   * Find a user by ID.
   */
  async getById(id: string) {
    const result = await db.select().from(users).where(eq(users.id, id)).get();
    return result || null;
  }

  /**
   * Create a new user.
   */
  async create(data: { username: string; passwordHash: string }) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      ...data,
    });
    return this.getById(id);
  }

  /**
   * Get user settings.
   */
  async getSettings(userId: string) {
    const result = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .get();
    return result || null;
  }

  /**
   * Update or Create user settings.
   */
  async upsertSettings(userId: string, settings: Partial<typeof userSettings.$inferSelect>) {
    const existing = await this.getSettings(userId);
    if (existing) {
      await db.update(userSettings).set(settings).where(eq(userSettings.userId, userId));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.insert(userSettings).values({ userId, ...settings } as any);
    }
    return this.getSettings(userId);
  }
}

export const userRepository = new UserRepository();
