import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// =============================================================================
// USERS & AUTHENTICATION
// =============================================================================

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    usernameIdx: uniqueIndex('users_username_unique').on(table.username),
  }),
);

export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  modelParsingText: text('model_parsing_text').notNull().default('google/gemini-3-flash-preview'),
  modelParsingVision: text('model_parsing_vision')
    .notNull()
    .default('google/gemini-3-flash-preview'),
  modelCategorization: text('model_categorization')
    .notNull()
    .default('google/gemini-3-flash-preview'),
  modelChat: text('model_chat').notNull().default('google/gemini-3-flash-preview'),
  modelEmbedding: text('model_embedding').notNull().default('openai/text-embedding-3-large'),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
