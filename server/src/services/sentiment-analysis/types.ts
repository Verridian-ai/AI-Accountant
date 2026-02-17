/**
 * Sentiment Analysis — Type Definitions
 */

export interface SentimentConfig {
  maxTopicsPerDay: number;
  cacheTtlMs: number;
  searchResultLimit: number;
}

export interface ArticleInfo {
  title: string;
  url: string;
  source: string;
  snippet: string;
  publishedDate: string | null;
}

export interface ResearchResult {
  topic: string;
  query: string;
  articles: ArticleInfo[];
  summary: string;
  keyFindings: string[];
  relatedTopics: string[];
  fetchedAt: string;
}

export interface SentimentResult {
  sentimentScore: number;
  sentimentLabel: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  confidence: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  topPositive: Array<{ title: string; reason: string }>;
  topNegative: Array<{ title: string; reason: string }>;
  summary: string;
}

export interface SentimentSnapshot {
  id: string;
  topic: string;
  query: string;
  sentimentScore: number;
  sentimentLabel: string;
  confidence: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalPosts: number;
  topPositive: Array<{ title: string; reason: string }>;
  topNegative: Array<{ title: string; reason: string }>;
  summary: string;
  sources: string[];
  analysisModel: string;
  observationDate: string;
  createdAt: string;
}

export interface ImpactAnalysis {
  event: string;
  impactSummary: string;
  affectedSectors: Array<{
    sector: string;
    impact: 'positive' | 'negative' | 'neutral';
    reason: string;
  }>;
  shortTermOutlook: string;
  longTermOutlook: string;
  confidence: number;
  sources: string[];
}

export interface TrendingTopic {
  topic: string;
  trendScore: number;
  recentArticles: number;
}
