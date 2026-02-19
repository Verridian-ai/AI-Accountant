/**
 * Market Intelligence Schema (Wave 19)
 * Market data feeds, economic indicators, prices, sentiment, alerts, and calendar.
 * Migrated from sqliteTable() to pgTable() (TASK-043).
 */

import { pgTable, text, integer, boolean, doublePrecision } from 'drizzle-orm/pg-core';

// NOTE: .references() to users (core.ts) omitted until core.ts migrates to pgTable (TASK-045).
// DB-level FK constraints remain intact in SQL migration files.
// Internal cross-references within this file (e.g. economicIndicators → marketDataFeeds) are preserved.

// ============================================================================
// MARKET DATA FEEDS
// ============================================================================

export const marketDataFeeds = pgTable('market_data_feeds', {
  id: text('id').primaryKey(),
  feedName: text('feed_name').notNull(),
  feedType: text('feed_type').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceName: text('source_name').notNull(),
  description: text('description'),
  refreshFrequency: text('refresh_frequency').notNull(),
  lastFetchedAt: text('last_fetched_at'),
  lastSuccessfulAt: text('last_successful_at'),
  status: text('status').notNull().default('active'),
  errorCount: integer('error_count').default(0),
  lastError: text('last_error'),
  config: text('config'), // JSONB in PG migration; text for backward compat
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// ECONOMIC INDICATORS
// ============================================================================

export const economicIndicators = pgTable('economic_indicators', {
  id: text('id').primaryKey(),
  feedId: text('feed_id')
    .notNull()
    .references(() => marketDataFeeds.id),
  indicatorCode: text('indicator_code').notNull(),
  indicatorName: text('indicator_name').notNull(),
  category: text('category').notNull(),
  value: doublePrecision('value').notNull(),
  previousValue: doublePrecision('previous_value'),
  changePct: doublePrecision('change_pct'),
  unit: text('unit').notNull(),
  frequency: text('frequency').notNull(),
  referencePeriod: text('reference_period').notNull(),
  source: text('source').notNull(),
  notes: text('notes'),
  observationDate: text('observation_date').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// MARKET PRICES
// ============================================================================

export const marketPrices = pgTable('market_prices', {
  id: text('id').primaryKey(),
  feedId: text('feed_id')
    .notNull()
    .references(() => marketDataFeeds.id),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  assetType: text('asset_type').notNull(),
  price: doublePrecision('price').notNull(),
  previousClose: doublePrecision('previous_close'),
  changeAmount: doublePrecision('change_amount'),
  changePct: doublePrecision('change_pct'),
  dayHigh: doublePrecision('day_high'),
  dayLow: doublePrecision('day_low'),
  volume: integer('volume'), // BIGINT migration deferred to TASK-046
  marketCap: doublePrecision('market_cap'),
  currency: text('currency').notNull().default('AUD'),
  exchange: text('exchange'),
  observationDate: text('observation_date').notNull(),
  observationTime: text('observation_time'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// SENTIMENT SNAPSHOTS
// ============================================================================

export const sentimentSnapshots = pgTable('sentiment_snapshots', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  query: text('query').notNull(),
  sentimentScore: doublePrecision('sentiment_score'),
  sentimentLabel: text('sentiment_label'),
  confidence: doublePrecision('confidence'),
  positiveCount: integer('positive_count').default(0),
  negativeCount: integer('negative_count').default(0),
  neutralCount: integer('neutral_count').default(0),
  totalPosts: integer('total_posts').default(0),
  topPositive: text('top_positive'), // JSONB migration deferred to TASK-046
  topNegative: text('top_negative'), // JSONB migration deferred to TASK-046
  summary: text('summary'),
  sources: text('sources'), // JSONB migration deferred to TASK-046
  analysisModel: text('analysis_model'),
  observationDate: text('observation_date').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// MARKET ALERTS
// ============================================================================

export const marketAlerts = pgTable('market_alerts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE — .references() deferred to TASK-045
  alertType: text('alert_type').notNull(),
  targetType: text('target_type').notNull(),
  targetSymbol: text('target_symbol'),
  targetIndicator: text('target_indicator'),
  condition: text('condition').notNull(),
  thresholdValue: doublePrecision('threshold_value').notNull(),
  currentValue: doublePrecision('current_value'),
  isActive: boolean('is_active').default(true),
  isTriggered: boolean('is_triggered').default(false),
  lastTriggeredAt: text('last_triggered_at'),
  notificationMethod: text('notification_method').default('in_app'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// ECONOMIC CALENDAR
// ============================================================================

export const economicCalendar = pgTable('economic_calendar', {
  id: text('id').primaryKey(),
  eventName: text('event_name').notNull(),
  eventType: text('event_type').notNull(),
  source: text('source').notNull(),
  scheduledDate: text('scheduled_date').notNull(),
  scheduledTime: text('scheduled_time'),
  country: text('country').notNull().default('AU'),
  importance: text('importance').notNull().default('medium'),
  previousValue: text('previous_value'),
  forecastValue: text('forecast_value'),
  actualValue: text('actual_value'),
  impactDescription: text('impact_description'),
  isCompleted: boolean('is_completed').default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type MarketDataFeed = typeof marketDataFeeds.$inferSelect;
export type NewMarketDataFeed = typeof marketDataFeeds.$inferInsert;
export type EconomicIndicator = typeof economicIndicators.$inferSelect;
export type NewEconomicIndicator = typeof economicIndicators.$inferInsert;
export type MarketPrice = typeof marketPrices.$inferSelect;
export type NewMarketPrice = typeof marketPrices.$inferInsert;
export type SentimentSnapshot = typeof sentimentSnapshots.$inferSelect;
export type NewSentimentSnapshot = typeof sentimentSnapshots.$inferInsert;
export type MarketAlert = typeof marketAlerts.$inferSelect;
export type NewMarketAlert = typeof marketAlerts.$inferInsert;
export type EconomicCalendarEvent = typeof economicCalendar.$inferSelect;
export type NewEconomicCalendarEvent = typeof economicCalendar.$inferInsert;
