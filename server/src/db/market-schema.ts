/**
 * Market Intelligence Schema (Wave 19)
 * Market data feeds, economic indicators, prices, sentiment, alerts, and calendar.
 * Uses sqliteTable() — the project-wide convention; wrapPgDb() proxies PG at runtime.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from '../schema/core.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// MARKET DATA FEEDS
// ============================================================================

export const marketDataFeeds = sqliteTable('market_data_feeds', {
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
  config: text('config'), // JSONB in PG migration; text via sqliteTable
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// ECONOMIC INDICATORS
// ============================================================================

export const economicIndicators = sqliteTable('economic_indicators', {
  id: text('id').primaryKey(),
  feedId: text('feed_id')
    .notNull()
    .references(() => marketDataFeeds.id),
  indicatorCode: text('indicator_code').notNull(),
  indicatorName: text('indicator_name').notNull(),
  category: text('category').notNull(),
  value: real('value').notNull(),
  previousValue: real('previous_value'),
  changePct: real('change_pct'),
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

export const marketPrices = sqliteTable('market_prices', {
  id: text('id').primaryKey(),
  feedId: text('feed_id')
    .notNull()
    .references(() => marketDataFeeds.id),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  assetType: text('asset_type').notNull(),
  price: real('price').notNull(),
  previousClose: real('previous_close'),
  changeAmount: real('change_amount'),
  changePct: real('change_pct'),
  dayHigh: real('day_high'),
  dayLow: real('day_low'),
  volume: integer('volume'), // BIGINT in PG; integer via sqliteTable
  marketCap: real('market_cap'),
  currency: text('currency').notNull().default('AUD'),
  exchange: text('exchange'),
  observationDate: text('observation_date').notNull(),
  observationTime: text('observation_time'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// SENTIMENT SNAPSHOTS
// ============================================================================

export const sentimentSnapshots = sqliteTable('sentiment_snapshots', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  query: text('query').notNull(),
  sentimentScore: real('sentiment_score'),
  sentimentLabel: text('sentiment_label'),
  confidence: real('confidence'),
  positiveCount: integer('positive_count').default(0),
  negativeCount: integer('negative_count').default(0),
  neutralCount: integer('neutral_count').default(0),
  totalPosts: integer('total_posts').default(0),
  topPositive: text('top_positive'), // JSONB in PG migration; text via sqliteTable
  topNegative: text('top_negative'), // JSONB in PG migration; text via sqliteTable
  summary: text('summary'),
  sources: text('sources'), // JSONB in PG migration; text via sqliteTable
  analysisModel: text('analysis_model'),
  observationDate: text('observation_date').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// MARKET ALERTS
// ============================================================================

export const marketAlerts = sqliteTable('market_alerts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  alertType: text('alert_type').notNull(),
  targetType: text('target_type').notNull(),
  targetSymbol: text('target_symbol'),
  targetIndicator: text('target_indicator'),
  condition: text('condition').notNull(),
  thresholdValue: real('threshold_value').notNull(),
  currentValue: real('current_value'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isTriggered: integer('is_triggered', { mode: 'boolean' }).default(false),
  lastTriggeredAt: text('last_triggered_at'),
  notificationMethod: text('notification_method').default('in_app'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// ECONOMIC CALENDAR
// ============================================================================

export const economicCalendar = sqliteTable('economic_calendar', {
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
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
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
