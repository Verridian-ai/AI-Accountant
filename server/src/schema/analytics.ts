import { pgTable, text, integer, boolean, doublePrecision } from 'drizzle-orm/pg-core';
import { users } from './core.js';
import { accounts } from './banking.js';
import { transactions } from './transactions.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// PREDICTIVE ANALYTICS & COMPLIANCE MONITORING (Wave 15)
// ============================================================================

export const cashFlowForecasts = pgTable('cash_flow_forecasts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  accountId: text('account_id').references(() => accounts.id),
  name: text('name').notNull(),
  forecastType: text('forecast_type').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  granularity: text('granularity').notNull().default('monthly'),
  accuracyScore: doublePrecision('accuracy_score'),
  confidenceLevel: doublePrecision('confidence_level').default(0.85),
  parameters: text('parameters'),
  status: text('status').notNull().default('draft'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cashFlowForecastPeriods = pgTable('cash_flow_forecast_periods', {
  id: text('id').primaryKey(),
  forecastId: text('forecast_id')
    .notNull()
    .references(() => cashFlowForecasts.id, { onDelete: 'cascade' }),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  predictedInflow: integer('predicted_inflow').notNull().default(0),
  predictedOutflow: integer('predicted_outflow').notNull().default(0),
  predictedNet: integer('predicted_net').notNull().default(0),
  actualInflow: integer('actual_inflow'),
  actualOutflow: integer('actual_outflow'),
  actualNet: integer('actual_net'),
  variance: integer('variance'),
  variancePct: doublePrecision('variance_pct'),
  confidenceLower: integer('confidence_lower'),
  confidenceUpper: integer('confidence_upper'),
  breakdown: text('breakdown'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const anomalyAlerts = pgTable('anomaly_alerts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  accountId: text('account_id').references(() => accounts.id),
  transactionId: text('transaction_id').references(() => transactions.id),
  alertType: text('alert_type').notNull(),
  severity: text('severity').notNull().default('medium'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  details: text('details'),
  status: text('status').notNull().default('open'),
  resolvedBy: text('resolved_by'),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const complianceChecks = pgTable('compliance_checks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  obligationType: text('obligation_type').notNull(),
  period: text('period').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('pending'),
  lodgedDate: text('lodged_date'),
  amountDue: integer('amount_due'),
  amountPaid: integer('amount_paid'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  riskLevel: text('risk_level').default('low'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const complianceSchedules = pgTable('compliance_schedules', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  obligationType: text('obligation_type').notNull(),
  frequency: text('frequency').notNull(),
  baseDueDay: integer('base_due_day').notNull(),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(14),
  autoGenerate: integer('auto_generate').notNull().default(1),
  lastGenerated: text('last_generated'),
  enabled: integer('enabled').notNull().default(1),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TEMPORAL INTELLIGENCE (Wave 17)
// ============================================================================

export const temporalQueries = pgTable('temporal_queries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  queryType: text('query_type').notNull(),
  targetEntity: text('target_entity').notNull(),
  timeStart: text('time_start').notNull(),
  timeEnd: text('time_end'),
  timeGranularity: text('time_granularity').default('monthly'),
  queryParameters: text('query_parameters').notNull(),
  cogneeDataset: text('cognee_dataset'),
  cogneeSearchType: text('cognee_search_type').default('GRAPH_COMPLETION'),
  resultCache: text('result_cache'),
  cacheExpiresAt: text('cache_expires_at'),
  executionCount: integer('execution_count').notNull().default(0),
  lastExecutedAt: text('last_executed_at'),
  averageExecutionMs: integer('average_execution_ms'),
  isSaved: boolean('is_saved').notNull().default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const crossModuleInsights = pgTable('cross_module_insights', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  insightType: text('insight_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull().default('info'),
  sourceModules: text('source_modules').notNull(),
  relatedEntities: text('related_entities').notNull(),
  timeRangeStart: text('time_range_start'),
  timeRangeEnd: text('time_range_end'),
  confidence: doublePrecision('confidence').notNull().default(0.5),
  evidence: text('evidence').notNull(),
  recommendedAction: text('recommended_action'),
  status: text('status').notNull().default('new'),
  actedOnAt: text('acted_on_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at'),
});

export const intelligenceSubscriptions = pgTable('intelligence_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  subscriptionType: text('subscription_type').notNull(),
  filterCriteria: text('filter_criteria').notNull(),
  notificationChannel: text('notification_channel').notNull().default('in_app'),
  notificationConfig: text('notification_config'),
  isActive: boolean('is_active').notNull().default(true),
  triggerCount: integer('trigger_count').notNull().default(0),
  lastTriggeredAt: text('last_triggered_at'),
  cooldownMinutes: integer('cooldown_minutes').default(60),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const moduleConnections = pgTable('module_connections', {
  id: text('id').primaryKey(),
  sourceModule: text('source_module').notNull(),
  targetModule: text('target_module').notNull(),
  connectionType: text('connection_type').notNull(),
  description: text('description').notNull(),
  strength: doublePrecision('strength').notNull().default(0.5),
  isBidirectional: boolean('is_bidirectional').notNull().default(false),
  metadata: text('metadata'),
  lastActivityAt: text('last_activity_at'),
  activityCount: integer('activity_count').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});
