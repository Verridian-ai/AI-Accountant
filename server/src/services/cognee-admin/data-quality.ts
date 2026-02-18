import { CogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type { DataQualityReport } from './types.js';
import { findComponents } from './helpers.js';

export async function getDataQualityReport(
  cogneeClient: CogneeClient,
  datasetName: string,
): Promise<DataQualityReport> {
  try {
    const graph = await cogneeClient.getDatasetGraph(datasetName);
    const nodes = (graph.nodes ?? []) as Array<Record<string, unknown>>;
    const edges = (graph.edges ?? []) as Array<Record<string, unknown>>;
    const connectedIds = new Set<string>();
    for (const edge of edges) {
      const s = String(edge.source ?? edge.from ?? edge.source_id ?? '');
      const t = String(edge.target ?? edge.to ?? edge.target_id ?? '');
      if (s) connectedIds.add(s);
      if (t) connectedIds.add(t);
    }
    const orphanedNodeCount = nodes.filter((n) => !connectedIds.has(String(n.id ?? ''))).length;
    const nodeKeys = new Map<string, number>();
    for (const node of nodes) {
      const key = `${String(node.name ?? node.label ?? '').toLowerCase()}::${String(node.type ?? node.entity_type ?? '')}`;
      nodeKeys.set(key, (nodeKeys.get(key) ?? 0) + 1);
    }
    const duplicateNodeCount = Array.from(nodeKeys.values())
      .filter((count) => count > 1)
      .reduce((sum, count) => sum + count - 1, 0);
    const { componentCount, largestComponentSize } = findComponents(nodes, edges);
    const avgDegree =
      nodes.length > 0 ? Math.round(((2 * edges.length) / nodes.length) * 100) / 100 : 0;
    const possibleEdges = nodes.length > 1 ? nodes.length * (nodes.length - 1) : 1;
    const graphDensity = Math.round((edges.length / possibleEdges) * 10000) / 10000;
    const recommendations: string[] = [];
    if (orphanedNodeCount > 0) {
      const pct = Math.round((orphanedNodeCount / Math.max(nodes.length, 1)) * 100);
      recommendations.push(
        `${orphanedNodeCount} orphaned nodes found (${pct}% of graph). Run pruneStaleNodes() to clean up.`,
      );
    }
    if (duplicateNodeCount > 0)
      recommendations.push(
        `${duplicateNodeCount} duplicate nodes detected. Run mergeDuplicateNodes() to consolidate.`,
      );
    if (componentCount > 1)
      recommendations.push(
        `Graph has ${componentCount} disconnected components. Consider adding cross-references or re-cognifying with a broader prompt.`,
      );
    if (avgDegree < 1.5 && nodes.length > 10)
      recommendations.push(
        `Low average degree (${avgDegree}). The graph may be sparsely connected. Re-cognify with a more specific entity extraction prompt.`,
      );
    if (graphDensity > 0.5 && nodes.length > 20)
      recommendations.push(
        `High graph density (${graphDensity}). Many nodes are connected to many others — consider using ontology constraints to refine relationships.`,
      );
    if (nodes.length === 0)
      recommendations.push(
        'Dataset has no graph nodes. Add data and run cognify to build the knowledge graph.',
      );
    if (recommendations.length === 0)
      recommendations.push('Graph quality looks good. No issues detected.');
    return {
      datasetName,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      orphanedNodeCount,
      duplicateNodeCount,
      disconnectedComponents: componentCount,
      largestComponent: largestComponentSize,
      graphDensity,
      avgDegree,
      recommendations,
    };
  } catch (err) {
    logger.warn({ err }, '[CogneeAdmin] getDataQualityReport error:');
    return {
      datasetName,
      nodeCount: 0,
      edgeCount: 0,
      orphanedNodeCount: 0,
      duplicateNodeCount: 0,
      disconnectedComponents: 0,
      largestComponent: 0,
      graphDensity: 0,
      avgDegree: 0,
      recommendations: [
        `Error generating report: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}
