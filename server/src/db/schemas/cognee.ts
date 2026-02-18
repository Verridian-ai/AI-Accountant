import { pgTable, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './core.js';

// =============================================================================
// COGNEE MULTI-USER
// =============================================================================

export const cogneeUserAccounts = pgTable(
  'cognee_user_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cogneeEmail: text('cognee_email').notNull(),
    cogneeRefreshToken: text('cognee_refresh_token'), // Encrypted refresh token, NOT password (D02 CRIT-03)
    cogneeUserId: text('cognee_user_id'),
    datasetPrefix: text('dataset_prefix').notNull(),
    isActive: boolean('is_active').default(true),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex('cognee_user_accounts_user_id_unique').on(table.userId),
    emailIdx: uniqueIndex('cognee_user_accounts_email_unique').on(table.cogneeEmail),
  }),
);

export const cogneeSessions = pgTable(
  'cognee_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionType: text('session_type').notNull().default('chat'),
    cogneeSessionId: text('cognee_session_id'),
    state: text('state').notNull().default('active'),
    contextData: text('context_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userStateIdx: index('cognee_sessions_user_state_idx').on(table.userId, table.state),
    expiresIdx: index('cognee_sessions_expires_idx').on(table.expiresAt),
  }),
);

export type PgCogneeUserAccount = typeof cogneeUserAccounts.$inferSelect;
export type NewPgCogneeUserAccount = typeof cogneeUserAccounts.$inferInsert;
export type PgCogneeSession = typeof cogneeSessions.$inferSelect;
export type NewPgCogneeSession = typeof cogneeSessions.$inferInsert;
