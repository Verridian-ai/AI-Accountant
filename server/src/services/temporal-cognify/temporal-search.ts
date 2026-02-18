/**
 * Temporal Cognify — Search operations (timeAwareSearch, addTimeMetadata)
 */

import type { CogneeClient, CogneeSearchType } from '../cognee_client.js';
import type { TimeSearchOptions, TemporalSearchResult } from './types.js';
import { AUSTRALIAN_SEASONS } from './types.js';
import {
  parseAustralianFinancialYear,
  getBasQuarter,
  enrichQueryWithTimeContext,
} from './temporal-helpers.js';

export async function timeAwareSearch(
  client: CogneeClient,
  query: string,
  timeOptions: TimeSearchOptions,
): Promise<TemporalSearchResult[]> {
  const enrichedQuery = enrichQueryWithTimeContext(query, timeOptions);
  const searchType = (timeOptions.searchType ?? 'GRAPH_COMPLETION') as CogneeSearchType;
  const topK = timeOptions.topK ?? 10;
  const results = await client.searchRich(enrichedQuery, timeOptions.dataset, topK, searchType);
  return results.map((r) => {
    const meta = r.metadata ?? {};
    return {
      content: r.text,
      score: r.score ?? 0,
      temporalMetadata: {
        date: meta.date as string | undefined,
        period: meta.period as string | undefined,
        quarter: meta.quarter as string | undefined,
        financialYear: meta.financial_year as string | undefined,
      },
      source: (meta.source as string) ?? timeOptions.dataset,
    };
  });
}

export function addTimeMetadata(
  entities: Array<Record<string, unknown>>,
  timeField: string,
): Array<Record<string, unknown>> {
  return entities.map((entity) => {
    const raw = entity[timeField];
    if (!raw) return entity;
    const date = new Date(String(raw));
    if (isNaN(date.getTime())) return entity;
    const month = date.getMonth() + 1;
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    const jan4 = new Date(date.getFullYear(), 0, 4);
    const daysSinceJan4 = Math.floor((date.getTime() - jan4.getTime()) / 86400000);
    const weekNumber = Math.ceil((daysSinceJan4 + jan4.getDay() + 1) / 7);
    return {
      ...entity,
      _year: date.getFullYear(),
      _quarter: `Q${Math.ceil(month / 3)}`,
      _month: month,
      _week: Math.min(weekNumber, 52),
      _day_of_week: dayOfWeek,
      _financial_year: parseAustralianFinancialYear(date),
      _bas_quarter: getBasQuarter(date),
      _is_eofy: month === 6,
      _is_christmas_period: month === 12 || month === 1,
      _season: AUSTRALIAN_SEASONS[month],
    };
  });
}
