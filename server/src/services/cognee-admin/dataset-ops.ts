import { CogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type { DatasetInfo, DatasetDetail } from './types.js';
import { categorizeDataset } from './helpers.js';

export async function listDatasets(cogneeClient: CogneeClient): Promise<DatasetInfo[]> {
  try {
    const [datasets, statuses] = await Promise.all([
      cogneeClient.listDatasets(),
      cogneeClient.getDatasetStatus(),
    ]);
    return datasets.map((d) => {
      const status = (statuses as Record<string, string>)[d.name] ?? 'unknown';
      return {
        name: d.name,
        id: d.id,
        documentCount: 0,
        status,
        category: categorizeDataset(d.name),
        lastCognified: status === 'COMPLETED' ? new Date().toISOString() : null,
        sizeEstimate: 'N/A',
      };
    });
  } catch (err) {
    logger.warn({ err }, '[CogneeAdmin] listDatasets error:');
    return [];
  }
}

export async function getDatasetDetail(
  cogneeClient: CogneeClient,
  datasetName: string,
): Promise<DatasetDetail> {
  try {
    const [graph, statuses] = await Promise.all([
      cogneeClient.getDatasetGraph(datasetName),
      cogneeClient.getDatasetStatus(),
    ]);
    const nodes = (graph.nodes ?? []) as Array<Record<string, unknown>>;
    const edges = (graph.edges ?? []) as Array<Record<string, unknown>>;

    const entityTypes: Record<string, number> = {};
    for (const node of nodes) {
      const nodeType = String(node.type ?? node.label ?? node.entity_type ?? 'unknown');
      entityTypes[nodeType] = (entityTypes[nodeType] ?? 0) + 1;
    }
    const relationshipTypes: Record<string, number> = {};
    for (const edge of edges) {
      const relType = String(edge.type ?? edge.relationship_type ?? edge.label ?? 'unknown');
      relationshipTypes[relType] = (relationshipTypes[relType] ?? 0) + 1;
    }
    const avgDegree = nodes.length > 0 ? (2 * edges.length) / nodes.length : 0;
    const status = (statuses as Record<string, string>)[datasetName] ?? 'unknown';

    return {
      name: datasetName,
      documentCount: 0,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      status,
      graphSummary: {
        entityTypes,
        relationshipTypes,
        avgDegree: Math.round(avgDegree * 100) / 100,
      },
    };
  } catch (err) {
    logger.warn({ err }, '[CogneeAdmin] getDatasetDetail error:');
    return {
      name: datasetName,
      documentCount: 0,
      nodeCount: 0,
      edgeCount: 0,
      status: 'error',
      graphSummary: { entityTypes: {}, relationshipTypes: {}, avgDegree: 0 },
    };
  }
}

export async function createDataset(cogneeClient: CogneeClient, name: string): Promise<void> {
  await cogneeClient.createDataset(name);
}

export async function deleteDataset(
  cogneeClient: CogneeClient,
  datasetName: string,
): Promise<{ deleted: boolean; error?: string }> {
  try {
    const baseUrl =
      (cogneeClient as unknown as { baseUrl: string }).baseUrl ?? 'http://localhost:9010';
    const res = await fetch(`${baseUrl}/api/v1/datasets/${encodeURIComponent(datasetName)}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) return { deleted: true };
    const body = await res.text().catch(() => '');
    return { deleted: false, error: `HTTP ${res.status}: ${body}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, '[CogneeAdmin] deleteDataset error:');
    return { deleted: false, error: message };
  }
}
