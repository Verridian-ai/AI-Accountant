import type { DatasetCategory } from './types.js';
import { DATASET_CATEGORY_MAP } from './types.js';

export function categorizeDataset(name: string): DatasetCategory {
  return DATASET_CATEGORY_MAP[name] ?? 'general';
}

export function findComponents(
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
  let componentCount = 0;
  let largestComponentSize = 0;

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
