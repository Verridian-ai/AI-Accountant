export interface TemporalCognifyOptions {
  timeField: string;
  dateFormat?: string;
  timeGranularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  addSeasonalContext?: boolean;
  addBusinessCycleContext?: boolean;
  customPrompt?: string;
}

export interface TemporalCognifyResult {
  dataset: string;
  entitiesProcessed: number;
  temporalMetadataAdded: number;
  timeRange: { start: string; end: string };
  granularityUsed: string;
  status: 'completed' | 'in_progress' | 'failed';
}

export interface TimeSearchOptions {
  dataset: string;
  timeStart: string;
  timeEnd?: string;
  timeGranularity?: string;
  searchType?: string;
  includeAdjacentPeriods?: boolean;
  topK?: number;
}

export interface TemporalSearchResult {
  content: string;
  score: number;
  temporalMetadata: {
    date?: string;
    period?: string;
    quarter?: string;
    financialYear?: string;
  };
  source: string;
}

export interface TemporalQueryInput {
  queryType: 'point_in_time' | 'time_range' | 'trend_over_time' | 'comparison' | 'evolution';
  targetEntity: string;
  timeStart: string;
  timeEnd?: string;
  timeGranularity?: string;
  parameters: Record<string, unknown>;
  useCache?: boolean;
}

export interface TemporalQueryResult {
  queryId: string;
  results: TemporalSearchResult[];
  summary: string;
  timeRange: { start: string; end: string };
  fromCache: boolean;
  executionMs: number;
}

export interface TimelineEvent {
  date: string;
  type: string;
  module: string;
  title: string;
  description: string;
  severity?: string;
  amount?: number;
  relatedEntityId?: string;
}

/** Row shape from the temporalQueries table */
export interface TemporalQueryRow {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  queryType: string;
  targetEntity: string;
  timeStart: string;
  timeEnd: string | null;
  timeGranularity: string | null;
  queryParameters: string;
  cogneeDataset: string | null;
  cogneeSearchType: string | null;
  resultCache: string | null;
  cacheExpiresAt: string | null;
  executionCount: number;
  lastExecutedAt: string | null;
  averageExecutionMs: number | null;
  isSaved: boolean | number | null;
  createdAt: string;
  updatedAt: string;
}

/** Australian Seasons (meteorological, Southern Hemisphere) */
export const AUSTRALIAN_SEASONS: Record<number, string> = {
  1: 'summer',
  2: 'summer',
  3: 'autumn',
  4: 'autumn',
  5: 'autumn',
  6: 'winter',
  7: 'winter',
  8: 'winter',
  9: 'spring',
  10: 'spring',
  11: 'spring',
  12: 'summer',
};
