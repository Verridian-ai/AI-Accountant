import { CogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type { ReindexOptions, ReindexResult } from './types.js';

export async function reindexDataset(
  cogneeClient: CogneeClient,
  datasetName: string,
  options?: ReindexOptions,
): Promise<ReindexResult> {
  const start = Date.now();
  try {
    const background = options?.runInBackground ?? true;
    await cogneeClient.cognify([datasetName], background, options?.customPrompt);
    if (background)
      return {
        datasetName,
        status: 'started',
        nodesCreated: 0,
        edgesCreated: 0,
        durationMs: Date.now() - start,
      };
    const graph = await cogneeClient.getDatasetGraph(datasetName);
    return {
      datasetName,
      status: 'completed',
      nodesCreated: (graph.nodes ?? []).length,
      edgesCreated: (graph.edges ?? []).length,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, '[CogneeAdmin] reindexDataset error:');
    return {
      datasetName,
      status: 'failed',
      nodesCreated: 0,
      edgesCreated: 0,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

export async function reindexAll(
  cogneeClient: CogneeClient,
): Promise<Record<string, ReindexResult>> {
  const results: Record<string, ReindexResult> = {};
  try {
    const datasets = await cogneeClient.listDatasets();
    for (const dataset of datasets) {
      results[dataset.name] = await reindexDataset(cogneeClient, dataset.name, {
        runInBackground: false,
      });
    }
  } catch (err) {
    logger.warn({ err }, '[CogneeAdmin] reindexAll error:');
  }
  return results;
}
