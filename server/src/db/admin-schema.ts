/**
 * Admin Backend Schema (Wave 20)
 * Drizzle ORM definitions for admin users, agent tracking, system metrics,
 * health checks, activity logging, feature flags, and agent configuration.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ============================================================================
// ADMIN USERS
// ============================================================================

export const adminUsers = sqliteTable('admin_users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  displayName: text('display_name'),
  role: text('role').notNull().default('admin'),
  permissions: text('permissions').notNull().default('[]'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastLoginAt: text('last_login_at'),
  loginCount: integer('login_count').notNull().default(0),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: text('locked_until'),
  mfaSecret: text('mfa_secret'),
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// AGENT EXECUTIONS
// ============================================================================

export const agentExecutions = sqliteTable('agent_executions', {
  id: text('id').primaryKey(),
  agentType: text('agent_type').notNull(),
  agentName: text('agent_name'),
  status: text('status').notNull().default('running'),
  inputSummary: text('input_summary'),
  outputSummary: text('output_summary'),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  estimatedCostUsd: real('estimated_cost_usd').notNull().default(0),
  modelUsed: text('model_used'),
  toolCallsCount: integer('tool_calls_count').notNull().default(0),
  toolCalls: text('tool_calls').notNull().default('[]'),
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  durationMs: integer('duration_ms'),
  triggeredBy: text('triggered_by').notNull().default('system'),
  context: text('context').notNull().default('{}'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// AGENT CONFIGURATIONS
// ============================================================================

export const agentConfigurations = sqliteTable('agent_configurations', {
  id: text('id').primaryKey(),
  agentType: text('agent_type').notNull().unique(),
  displayName: text('display_name'),
  description: text('description'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  model: text('model').notNull(),
  maxInputTokens: integer('max_input_tokens').notNull(),
  maxOutputTokens: integer('max_output_tokens').notNull(),
  temperature: real('temperature').notNull().default(0.1),
  systemPromptOverride: text('system_prompt_override'),
  toolsEnabled: text('tools_enabled').notNull().default('[]'),
  rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(10),
  rateLimitPerHour: integer('rate_limit_per_hour').notNull().default(100),
  circuitBreakerThreshold: integer('circuit_breaker_threshold').notNull().default(5),
  circuitBreakerRecoveryMs: integer('circuit_breaker_recovery_ms').notNull().default(60000),
  customConfig: text('custom_config').notNull().default('{}'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// SYSTEM METRICS
// ============================================================================

export const systemMetrics = sqliteTable('system_metrics', {
  id: text('id').primaryKey(),
  metricName: text('metric_name').notNull(),
  metricType: text('metric_type').notNull(),
  value: real('value').notNull(),
  unit: text('unit'),
  tags: text('tags').notNull().default('{}'),
  source: text('source'),
  observationTime: text('observation_time').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// SYSTEM HEALTH CHECKS
// ============================================================================

export const systemHealthChecks = sqliteTable('system_health_checks', {
  id: text('id').primaryKey(),
  serviceName: text('service_name').notNull(),
  checkType: text('check_type').notNull(),
  status: text('status').notNull(),
  responseTimeMs: integer('response_time_ms'),
  details: text('details').notNull().default('{}'),
  errorMessage: text('error_message'),
  checkedAt: text('checked_at').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// USER ACTIVITY LOG
// ============================================================================

export const userActivityLog = sqliteTable('user_activity_log', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  sessionId: text('session_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  details: text('details').notNull().default('{}'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  durationMs: integer('duration_ms'),
  status: text('status').notNull().default('success'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const featureFlags = sqliteTable('feature_flags', {
  id: text('id').primaryKey(),
  flagName: text('flag_name').notNull().unique(),
  displayName: text('display_name'),
  description: text('description'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  rolloutPercentage: integer('rollout_percentage').notNull().default(0),
  conditions: text('conditions').notNull().default('{}'),
  category: text('category').notNull().default('general'),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Admin Users
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;

// Agent Executions
export type AgentExecution = typeof agentExecutions.$inferSelect;
export type NewAgentExecution = typeof agentExecutions.$inferInsert;

// Agent Configurations
export type AgentConfiguration = typeof agentConfigurations.$inferSelect;
export type NewAgentConfiguration = typeof agentConfigurations.$inferInsert;

// System Metrics
export type SystemMetric = typeof systemMetrics.$inferSelect;
export type NewSystemMetric = typeof systemMetrics.$inferInsert;

// System Health Checks
export type SystemHealthCheck = typeof systemHealthChecks.$inferSelect;
export type NewSystemHealthCheck = typeof systemHealthChecks.$inferInsert;

// User Activity Log
export type UserActivityLogEntry = typeof userActivityLog.$inferSelect;
export type NewUserActivityLogEntry = typeof userActivityLog.$inferInsert;

// Feature Flags
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
