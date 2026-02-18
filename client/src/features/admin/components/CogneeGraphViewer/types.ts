import type { NodeObject, LinkObject } from 'three-forcegraph';

export interface CogneeGraphViewerProps {
  datasetName?: string;
  initialFocus?: string;
  height?: number;
  width?: number;
}

export interface GraphNode extends NodeObject {
  id: string;
  name: string;
  type: string;
  dataset: string;
  properties: Record<string, unknown>;
  connections: number;
  val: number;
  color: string;
}

export interface GraphLink extends LinkObject<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  properties: Record<string, unknown>;
  color: string;
}

export interface RawGraphResponse {
  nodes?: RawNode[];
  links?: RawLink[];
  edges?: RawLink[];
  data?: {
    nodes?: RawNode[];
    links?: RawLink[];
    edges?: RawLink[];
  };
}

export interface RawNode {
  id: string | number;
  name?: string;
  label?: string;
  type?: string;
  entity_type?: string;
  dataset?: string;
  connections?: number;
  degree?: number;
  properties?: Record<string, unknown>;
}

export interface RawLink {
  source: string | number;
  target: string | number;
  type?: string;
  relationship?: string;
  properties?: Record<string, unknown>;
}
