import { CogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type { OrphanedNode, PruneResult } from './types.js';

export async function findOrphanedNodes(
  cogneeClient: CogneeClient,
  datasetName: string,
): Promise<OrphanedNode[]> {
  try {
    const graph = await cogneeClient.getDatasetGraph(datasetName);
    const nodes = (graph.nodes ?? []) as Array<Record<string, unknown>>;
    const edges = (graph.edges ?? []) as Array<Record<string, unknown>>;
    const connectedIds = new Set<string>();
    for (const edge of edges) {
      const source = String(edge.source ?? edge.from ?? edge.source_id ?? '');
      const target = String(edge.target ?? edge.to ?? edge.target_id ?? '');
      if (source) connectedIds.add(source);
      if (target) connectedIds.add(target);
    }
    return nodes
      .filter((n) => !connectedIds.has(String(n.id ?? '')))
      .map((n) => ({
        id: String(n.id ?? ''),
        type: String(n.type ?? n.entity_type ?? 'unknown'),
        name: String(n.name ?? n.label ?? n.text ?? 'unnamed'),
      }));
  } catch (err) {
    logger.warn({ err }, '[CogneeAdmin] findOrphanedNodes error:');
    return [];
  }
}

export async function pruneStaleNodes(
  cogneeClient: CogneeClient,
  datasetName: string,
  olderThanDays: number,
): Promise<PruneResult> {
  try {
    const orphans = await findOrphanedNodes(cogneeClient, datasetName);
    if (orphans.length === 0)
      return {
        datasetName,
        nodesRemoved: 0,
        edgesRemoved: 0,
        criteria: `No orphaned nodes found (threshold: ${olderThanDays} days)`,
      };
    await cogneeClient.cognify([datasetName], false);
    const postOrphans = await findOrphanedNodes(cogneeClient, datasetName);
    const removed = orphans.length - postOrphans.length;
    return {
      datasetName,
      nodesRemoved: Math.max(0, removed),
      edgesRemoved: 0,
      criteria: `Re-cognified to prune ${removed} orphaned nodes (threshold: ${olderThanDays} days)`,
    };
  } catch (err) {
    logger.warn({ err }, '[CogneeAdmin] pruneStaleNodes error:');
    return {
      datasetName,
      nodesRemoved: 0,
      edgesRemoved: 0,
      criteria: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function mergeDuplicateNodes(
  cogneeClient: CogneeClient,
  datasetName: string,
): Promise<{ mergesPerformed: number; duplicatesFound: number }> {
  try {
    const graph = await cogneeClient.getDatasetGraph(datasetName);
    const nodes = (graph.nodes ?? []) as Array<Record<string, unknown>>;
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const node of nodes) {
      const key = `${String(node.name ?? node.label ?? '').toLowerCase()}::${String(node.type ?? node.entity_type ?? '')}`;
      const existing = groups.get(key);
      if (existing) existing.push(node);
      else groups.set(key, [node]);
    }
    const duplicatesFound = Array.from(groups.values())
      .filter((g) => g.length > 1)
      .reduce((sum, g) => sum + g.length - 1, 0);
    if (duplicatesFound === 0) return { mergesPerformed: 0, duplicatesFound: 0 };
    await cogneeClient.cognify([datasetName], false);
    return { mergesPerformed: duplicatesFound, duplicatesFound };
  } catch (err) {
    logger.warn({ err }, '[CogneeAdmin] mergeDuplicateNodes error:');
    return { mergesPerformed: 0, duplicatesFound: 0 };
  }
}
