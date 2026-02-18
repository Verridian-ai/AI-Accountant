import { CogneeClient, type CogneeSearchType } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type { SearchTestOptions, SearchTestResult } from './types.js';

export async function testSearch(
  cogneeClient: CogneeClient,
  query: string,
  options: SearchTestOptions,
): Promise<SearchTestResult> {
  const totalStart = Date.now();
  const searchResults: SearchTestResult['results'] = [];
  try {
    let targetDatasets = options.datasets;
    if (!targetDatasets || targetDatasets.length === 0) {
      const allDatasets = await cogneeClient.listDatasets();
      targetDatasets = allDatasets.map((d) => d.name);
    }
    const searchTypes: CogneeSearchType[] = options.searchTypes ?? [
      'CHUNKS',
      'CHUNKS_LEXICAL',
      'GRAPH_COMPLETION',
    ];
    const topK = options.topK ?? 5;
    const combinations: Array<{ dataset: string; searchType: CogneeSearchType }> = [];
    for (const dataset of targetDatasets) {
      for (const searchType of searchTypes) {
        combinations.push({ dataset, searchType });
      }
    }
    const results = await Promise.all(
      combinations.map(async ({ dataset, searchType }) => {
        const start = Date.now();
        try {
          const hits = await cogneeClient.searchRich(query, dataset, topK, searchType);
          return {
            searchType,
            dataset,
            resultCount: hits.length,
            topResults: hits.map((h) => ({
              content: h.text.slice(0, 500),
              score: h.score,
              metadata: h.metadata,
            })),
            latencyMs: Date.now() - start,
          };
        } catch {
          return {
            searchType,
            dataset,
            resultCount: 0,
            topResults: [],
            latencyMs: Date.now() - start,
          };
        }
      }),
    );
    searchResults.push(...results);
  } catch (err) {
    logger.warn({ err }, '[CogneeAdmin] testSearch error:');
  }
  return { query, results: searchResults, totalLatencyMs: Date.now() - totalStart };
}
