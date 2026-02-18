// ============================================================================
// TYPES — Cross-Module Intelligence
// ============================================================================

export interface CrossModuleInsight {
  id: string;
  userId: string;
  insightType: string;
  title: string;
  description: string;
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
  sourceModules: string[];
  relatedEntities: Array<{ type: string; id: string; module: string }>;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  confidence: number;
  evidence: Record<string, unknown>;
  recommendedAction?: string;
  status: string;
  actedOnAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface Correlation {
  moduleA: string;
  metricA: string;
  moduleB: string;
  metricB: string;
  coefficient: number;
  pValue: number;
  sampleSize: number;
  timeRange: { start: string; end: string };
  interpretation: string;
}

export interface ModuleConnection {
  id: string;
  sourceModule: string;
  targetModule: string;
  connectionType: string;
  description: string;
  strength: number;
  isBidirectional: boolean;
  activityCount: number;
  lastActivityAt: string | null;
}

export interface TimelineEntry {
  date: string;
  module: string;
  eventType: string;
  title: string;
  description: string;
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
  amount?: number;
  relatedInsights?: string[];
  metadata?: Record<string, unknown>;
}

export interface InsightScanOptions {
  modules?: string[];
  timeRange?: { start: string; end: string };
  minConfidence?: number;
  severityFilter?: string[];
  maxInsights?: number;
}

export interface InsightFilters {
  insightType?: string;
  severity?: string;
  status?: string;
  sourceModules?: string[];
  minConfidence?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface ConnectionFilters {
  sourceModule?: string;
  targetModule?: string;
  connectionType?: string;
  minStrength?: number;
}

export type TimeRange = { start: string; end: string };
