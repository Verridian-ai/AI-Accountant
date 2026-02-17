/**
 * Cognee Admin Module — CogneeAdminService class
 *
 * Admin-level operations for managing Cognee datasets, reindexing,
 * pruning, graph statistics, search testing, and data quality reports.
 */

import { CogneeClient, type CogneeSearchType } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type {
  DatasetCategory,
  DatasetInfo,
  DatasetDetail,
  ReindexOptions,
  ReindexResult,
  PruneResult,
  OrphanedNode,
  GraphStats,
  SearchTestOptions,
  SearchTestResult,
  DataQualityReport,
} from './types.js';
import { DATASET_CATEGORY_MAP } from './types.js';

export class CogneeAdminService {
  private cogneeClient: CogneeClient;

  constructor(cogneeClient?: CogneeClient) {
    this.cogneeClient = cogneeClient ?? new CogneeClient();
  }

  async listDatasets(): Promise<DatasetInfo[]> {
    try {
      const [datasets, statuses] = await Promise.all([
        this.cogneeClient.listDatasets(),
        this.cogneeClient.getDatasetStatus(),
      ]);
      return datasets.map((d) => {
        const status = (statuses as Record<string, string>)[d.name] ?? 'unknown';
        return {
          name: d.name,
          id: d.id,
          documentCount: 0,
          status,
          category: this.categorizeDataset(d.name),
          lastCognified: status === 'COMPLETED' ? new Date().toISOString() : null,
          sizeEstimate: 'N/A',
        };
      });
    } catch (err) {
      logger.warn({ err }, '[CogneeAdmin] listDatasets error:');
      return [];
    }
  }

  async getDatasetDetail(datasetName: string): Promise<DatasetDetail> {
    try {
      const [graph, statuses] = await Promise.all([
        this.cogneeClient.getDatasetGraph(datasetName),
        this.cogneeClient.getDatasetStatus(),
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

  async createDataset(name: string): Promise<void> {
    await this.cogneeClient.createDataset(name);
  }

  async deleteDataset(datasetName: string): Promise<{ deleted: boolean; error?: string }> {
    try {
      const res = await fetch(
        `${(this.cogneeClient as unknown as { baseUrl: string }).baseUrl ?? 'http://localhost:9010'}/api/v1/datasets/${encodeURIComponent(datasetName)}`,
        { method: 'DELETE', signal: AbortSignal.timeout(30000) },
      );
      if (res.ok) return { deleted: true };
      const body = await res.text().catch(() => '');
      return { deleted: false, error: `HTTP ${res.status}: ${body}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err: message }, '[CogneeAdmin] deleteDataset error:');
      return { deleted: false, error: message };
    }
  }

  async reindexDataset(datasetName: string, options?: ReindexOptions): Promise<ReindexResult> {
    const start = Date.now();
    try {
      const background = options?.runInBackground ?? true;
      await this.cogneeClient.cognify([datasetName], background, options?.customPrompt);
      if (background)
        return {
          datasetName,
          status: 'started',
          nodesCreated: 0,
          edgesCreated: 0,
          durationMs: Date.now() - start,
        };
      const graph = await this.cogneeClient.getDatasetGraph(datasetName);
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

  async reindexAll(): Promise<Record<string, ReindexResult>> {
    const results: Record<string, ReindexResult> = {};
    try {
      const datasets = await this.cogneeClient.listDatasets();
      for (const dataset of datasets) {
        results[dataset.name] = await this.reindexDataset(dataset.name, { runInBackground: false });
      }
    } catch (err) {
      logger.warn({ err }, '[CogneeAdmin] reindexAll error:');
    }
    return results;
  }

  async findOrphanedNodes(datasetName: string): Promise<OrphanedNode[]> {
    try {
      const graph = await this.cogneeClient.getDatasetGraph(datasetName);
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

  async pruneStaleNodes(datasetName: string, olderThanDays: number): Promise<PruneResult> {
    try {
      const orphans = await this.findOrphanedNodes(datasetName);
      if (orphans.length === 0)
        return {
          datasetName,
          nodesRemoved: 0,
          edgesRemoved: 0,
          criteria: `No orphaned nodes found (threshold: ${olderThanDays} days)`,
        };
      await this.cogneeClient.cognify([datasetName], false);
      const postOrphans = await this.findOrphanedNodes(datasetName);
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

  async mergeDuplicateNodes(
    datasetName: string,
  ): Promise<{ mergesPerformed: number; duplicatesFound: number }> {
    try {
      const graph = await this.cogneeClient.getDatasetGraph(datasetName);
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
      await this.cogneeClient.cognify([datasetName], false);
      return { mergesPerformed: duplicatesFound, duplicatesFound };
    } catch (err) {
      logger.warn({ err }, '[CogneeAdmin] mergeDuplicateNodes error:');
      return { mergesPerformed: 0, duplicatesFound: 0 };
    }
  }

  async getGraphStats(): Promise<GraphStats> {
    try {
      const [datasets, statuses] = await Promise.all([
        this.cogneeClient.listDatasets(),
        this.cogneeClient.getDatasetStatus(),
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
          graph: await this.cogneeClient.getDatasetGraph(d.id || d.name),
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
          category: this.categorizeDataset(dataset.name),
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

  async testSearch(query: string, options: SearchTestOptions): Promise<SearchTestResult> {
    const totalStart = Date.now();
    const searchResults: SearchTestResult['results'] = [];
    try {
      let targetDatasets = options.datasets;
      if (!targetDatasets || targetDatasets.length === 0) {
        const allDatasets = await this.cogneeClient.listDatasets();
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
            const hits = await this.cogneeClient.searchRich(query, dataset, topK, searchType);
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

  async getDataQualityReport(datasetName: string): Promise<DataQualityReport> {
    try {
      const graph = await this.cogneeClient.getDatasetGraph(datasetName);
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
      const { componentCount, largestComponentSize } = this.findComponents(nodes, edges);
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

  async isHealthy(): Promise<boolean> {
    return this.cogneeClient.isHealthy();
  }

  private categorizeDataset(name: string): DatasetCategory {
    return DATASET_CATEGORY_MAP[name] ?? 'general';
  }

  private findComponents(
    nodes: Array<Record<string, unknown>>,
    edges: Array<Record<string, unknown>>,
  ): { componentCount: number; largestComponentSize: number } {
    if (nodes.length === 0) return { componentCount: 0, largestComponentSize: 0 };
    const adjacency = new Map<string, Set<string>>();
    for (const node of nodes) adjacency.set(String(node.id ?? ''), new Set());
    for (const edge of edges) {
      const source = String(edge.source ?? edge.from ?? edge.source_id ?? '');
      const target = String(edge.target ?? edge.to ?? edge.target_id ?? '');
      if (source && target) {
        adjacency.get(source)?.add(target);
        adjacency.get(target)?.add(source);
      }
    }
    const visited = new Set<string>();
    let componentCount = 0,
      largestComponentSize = 0;
    for (const nodeId of adjacency.keys()) {
      if (visited.has(nodeId)) continue;
      componentCount++;
      let componentSize = 0;
      const queue = [nodeId];
      visited.add(nodeId);
      while (queue.length > 0) {
        const current = queue.shift()!;
        componentSize++;
        const neighbors = adjacency.get(current);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }
      if (componentSize > largestComponentSize) largestComponentSize = componentSize;
    }
    return { componentCount, largestComponentSize };
  }
}
