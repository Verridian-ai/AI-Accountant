import { pgTable, text, integer, real, boolean, timestamp, index } from 'drizzle-orm/pg-core';

// =============================================================================
// WAVE 2: Agent Sessions, Mutations & Audit Log
// =============================================================================

export const pgAgentSessions = pgTable(
  'agent_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
    status: text('status').notNull().default('active'),
    context: text('context'),
    totalMutations: integer('total_mutations').notNull().default(0),
    confirmedMutations: integer('confirmed_mutations').notNull().default(0),
    rejectedMutations: integer('rejected_mutations').notNull().default(0),
    queryCount: integer('query_count').notNull().default(0),
    agentTypesUsed: text('agent_types_used'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_pg_agent_sessions_user').on(table.userId),
    statusIdx: index('idx_pg_agent_sessions_status').on(table.status),
    lastActivityIdx: index('idx_pg_agent_sessions_last_activity').on(table.lastActivityAt),
  }),
);

export const pgAgentMutations = pgTable(
  'agent_mutations',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => pgAgentSessions.id),
    agentType: text('agent_type').notNull(),
    mutationType: text('mutation_type').notNull(),
    targetTable: text('target_table').notNull(),
    targetId: text('target_id'),
    targetIds: text('target_ids'),
    beforeState: text('before_state'),
    afterState: text('after_state').notNull(),
    description: text('description').notNull(),
    status: text('status').notNull().default('proposed'),
    confidence: real('confidence'),
    requiresConfirmation: boolean('requires_confirmation').notNull().default(true),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    errorMessage: text('error_message'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('idx_pg_agent_mutations_session').on(table.sessionId),
    statusIdx: index('idx_pg_agent_mutations_status').on(table.status),
    agentIdx: index('idx_pg_agent_mutations_agent').on(table.agentType),
    targetIdx: index('idx_pg_agent_mutations_target').on(table.targetTable),
    createdIdx: index('idx_pg_agent_mutations_created').on(table.createdAt),
    expiryIdx: index('idx_pg_agent_mutations_expiry').on(table.status, table.expiresAt),
  }),
);

export const pgAgentAuditLog = pgTable(
  'agent_audit_log',
  {
    id: text('id').primaryKey(),
    mutationId: text('mutation_id').references(() => pgAgentMutations.id),
    sessionId: text('session_id').references(() => pgAgentSessions.id),
    agentType: text('agent_type').notNull(),
    action: text('action').notNull(),
    targetTable: text('target_table'),
    targetId: text('target_id'),
    beforeState: text('before_state'),
    afterState: text('after_state'),
    metadata: text('metadata'),
    userId: text('user_id'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    mutationIdx: index('idx_pg_agent_audit_mutation').on(table.mutationId),
    sessionIdx: index('idx_pg_agent_audit_session').on(table.sessionId),
    agentIdx: index('idx_pg_agent_audit_agent').on(table.agentType),
    actionIdx: index('idx_pg_agent_audit_action').on(table.action),
    createdIdx: index('idx_pg_agent_audit_created').on(table.createdAt),
    targetIdx: index('idx_pg_agent_audit_target').on(table.targetTable),
  }),
);

export type PgAgentSession = typeof pgAgentSessions.$inferSelect;
export type NewPgAgentSession = typeof pgAgentSessions.$inferInsert;
export type PgAgentMutation = typeof pgAgentMutations.$inferSelect;
export type NewPgAgentMutation = typeof pgAgentMutations.$inferInsert;
export type PgAgentAuditLog = typeof pgAgentAuditLog.$inferSelect;
export type NewPgAgentAuditLog = typeof pgAgentAuditLog.$inferInsert;
