import type { GraphNode, GraphLink } from './types';

export function forceStep(nodes: GraphNode[], links: GraphLink[], alpha: number) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (alpha * 200) / (dist * dist);
      dx *= force;
      dy *= force;
      a.vx -= dx;
      a.vy -= dy;
      b.vx += dx;
      b.vy += dy;
    }
  }

  // Attraction via links
  for (const link of links) {
    const a = nodeMap.get(link.source);
    const b = nodeMap.get(link.target);
    if (!a || !b) continue;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - 80) * alpha * 0.005;
    dx = (dx / dist) * force;
    dy = (dy / dist) * force;
    a.vx += dx;
    a.vy += dy;
    b.vx -= dx;
    b.vy -= dy;
  }

  // Center gravity
  for (const node of nodes) {
    node.vx -= node.x * alpha * 0.001;
    node.vy -= node.y * alpha * 0.001;
  }

  // Apply + dampen
  for (const node of nodes) {
    node.vx *= 0.6;
    node.vy *= 0.6;
    node.x += node.vx;
    node.y += node.vy;
  }
}
