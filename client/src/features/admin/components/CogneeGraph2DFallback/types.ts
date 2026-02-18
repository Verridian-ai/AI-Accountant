export interface CogneeGraph2DFallbackProps {
  datasetName?: string;
  initialFocus?: string;
  height?: number;
  width?: number;
}

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  dataset: string;
  properties: Record<string, unknown>;
  connections: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
  color: string;
}

export interface RawNode2D {
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

export interface RawLink2D {
  source: string | number;
  target: string | number;
  type?: string;
  relationship?: string;
}

export interface RawGraphResponse2D {
  nodes?: RawNode2D[];
  links?: RawLink2D[];
  edges?: RawLink2D[];
  data?: {
    nodes?: RawNode2D[];
    links?: RawLink2D[];
    edges?: RawLink2D[];
  };
}
