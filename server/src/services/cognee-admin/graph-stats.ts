import { CogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type { GraphStats } from './types.js';
import { categorizeDataset } from './helpers.js';

export async function getGraphStats(cogneeClient: CogneeClient): Promise<GraphStats> {
  try {
    const [datasets, statuses] = await Promise.all([
      cogneeClient.listDatasets(),
      cogneeClient.getDatasetStatus(),
    ]);
    let totalNodes = 0,
      totalEdges = 0;
    const entityTypeDistribution: Record<string, number> = {};
    const relationshipTypeDistribution: Record<string, number> = {};
    const nodeConnections = new Map<string, { name: string; type: string; count: number }>();
    const datasetBreakdown: GraphStats['datasetBreakdown'] = [];

    const graphResults = await Promise.all(
      datasets.map(async (d) => ({
        dataset: d,
        graph: await cogneeClient.getDatasetGraph(d.id || d.name),
      })),
    );

    for (const { dataset, graph } of graphResults) {
      const nodes = (graph.nodes ?? []) as Array<Record<string, unknown>>;
      const edges = (graph.edges ?? []) as Array<Record<string, unknown>>;
      totalNodes += nodes.length;
      totalEdges += edges.length;
      const status = (statuses as Record<string, string>)[dataset.name] ?? 'unknown';
      datasetBreakdown.push({
        name: dataset.name,
        category: categorizeDataset(dataset.name),
        nodes: nodes.length,
        edges: edges.length,
        lastCognified: status === 'COMPLETED' ? new Date().toISOString() : null,
      });
      for (const node of nodes) {
        const t = String(node.type ?? node.entity_type ?? 'unknown');
        entityTypeDistribution[t] = (entityTypeDistribution[t] ?? 0) + 1;
      }
      for (const edge of edges) {
        const t = String(edge.type ?? edge.relationship_type ?? edge.label ?? 'unknown');
        relationshipTypeDistribution[t] = (relationshipTypeDistribution[t] ?? 0) + 1;
      }
      for (const edge of edges) {
        for (const nodeId of [
          String(edge.source ?? edge.from ?? edge.source_id ?? ''),
          String(edge.target ?? edge.to ?? edge.target_id ?? ''),
        ]) {
          if (!nodeId) continue;
          const existing = nodeConnections.get(nodeId);
          if (existing) existing.count++;
          else {
            const matchNode = nodes.find((n) => String(n.id) === nodeId);
            nodeConnections.set(nodeId, {
              name: matchNode ? String(matchNode.name ?? matchNode.label ?? nodeId) : nodeId,
              type: matchNode
                ? String(matchNode.type ?? matchNode.entity_type ?? 'unknown')
                : 'unknown',
              count: 1,
            });
          }
        }
      }
    }

    const topConnectedEntities = Array.from(nodeConnections.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map(({ name, type, count }) => ({ name, type, connections: count }));
    const possibleEdges = totalNodes > 1 ? totalNodes * (totalNodes - 1) : 1;
    const graphDensity = Math.round((totalEdges / possibleEdges) * 10000) / 10000;

    return {
      totalDatasets: datasets.length,
      totalNodes,
      totalEdges,
      totalDocuments: 0,
      datasetBreakdown,
      entityTypeDistribution,
      relationshipTypeDistribution,
      topConnectedEntities,
      graphDensity,
      avgPathLength: null,
    };
  } catch (err) {
    logger.warn({ err }, '[CogneeAdmin] getGraphStats error:');
    return {
      totalDatasets: 0,
      totalNodes: 0,
      totalEdges: 0,
      totalDocuments: 0,
      datasetBreakdown: [],
      entityTypeDistribution: {},
      relationshipTypeDistribution: {},
      topConnectedEntities: [],
      graphDensity: 0,
      avgPathLength: null,
    };
  }
}
