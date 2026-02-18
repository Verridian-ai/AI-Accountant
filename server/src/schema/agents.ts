import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';

// ============================================================================
// WAVE 2: Agent Sessions, Mutations & Audit Log
// ============================================================================

export const agentSessions = sqliteTable('agent_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  startedAt: text('started_at').notNull().default('CURRENT_TIMESTAMP'),
  lastActivityAt: text('last_activity_at').notNull().default('CURRENT_TIMESTAMP'),
  status: text('status').notNull().default('active'),
  context: text('context'),
  totalMutations: integer('total_mutations').notNull().default(0),
  confirmedMutations: integer('confirmed_mutations').notNull().default(0),
  rejectedMutations: integer('rejected_mutations').notNull().default(0),
  queryCount: integer('query_count').notNull().default(0),
  agentTypesUsed: text('agent_types_used'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const agentMutations = sqliteTable('agent_mutations', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => agentSessions.id),
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
  requiresConfirmation: integer('requires_confirmation', { mode: 'boolean' })
    .notNull()
    .default(true),
  confirmedAt: text('confirmed_at'),
  executedAt: text('executed_at'),
  rejectedAt: text('rejected_at'),
  rejectionReason: text('rejection_reason'),
  errorMessage: text('error_message'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const agentAuditLog = sqliteTable('agent_audit_log', {
  id: text('id').primaryKey(),
  mutationId: text('mutation_id').references(() => agentMutations.id),
  sessionId: text('session_id').references(() => agentSessions.id),
  agentType: text('agent_type').notNull(),
  action: text('action').notNull(),
  targetTable: text('target_table'),
  targetId: text('target_id'),
  beforeState: text('before_state'),
  afterState: text('after_state'),
  metadata: text('metadata'),
  userId: text('user_id'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// Type exports
export type AgentSessionRecord = typeof agentSessions.$inferSelect;
export type NewAgentSessionRecord = typeof agentSessions.$inferInsert;
export type AgentMutationRecord = typeof agentMutations.$inferSelect;
export type NewAgentMutationRecord = typeof agentMutations.$inferInsert;
export type AgentAuditLogRecord = typeof agentAuditLog.$inferSelect;
export type NewAgentAuditLogRecord = typeof agentAuditLog.$inferInsert;
