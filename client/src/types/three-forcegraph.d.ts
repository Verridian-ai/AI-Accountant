declare module 'three-forcegraph' {
  const ThreeForceGraph: unknown;
  export default ThreeForceGraph;
  export type NodeObject = Record<string, unknown>;
  export type LinkObject<T = unknown> = Record<string, unknown> & { __nodeType?: T };
}
