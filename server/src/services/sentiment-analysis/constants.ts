/**
 * Sentiment Analysis — Constants & Defaults
 */

import type { SentimentConfig } from './types.js';

export const DEFAULT_CONFIG: SentimentConfig = {
  maxTopicsPerDay: 20,
  cacheTtlMs: 60 * 60 * 1000, // 1 hour
  searchResultLimit: 10,
};

export const DEFAULT_FINANCIAL_TOPICS = [
  'Australian property market',
  'ASX stock market outlook',
  'RBA interest rate decision',
  'Australian inflation outlook',
  'cryptocurrency market Australia',
  'Australian banking sector',
  'small business confidence Australia',
  'Australian dollar outlook',
];

export const AI_TIMEOUT_MS = 30_000;
