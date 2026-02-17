export interface OntologyDefinition {
  name: string;
  description?: string;
  ontologyType: 'financial' | 'tax' | 'relationship' | 'compliance' | 'merchant' | 'custom';
  nodeTypes: Array<{
    name: string;
    properties: Array<{ name: string; type: string; required?: boolean }>;
    color?: string;
  }>;
  edgeTypes: Array<{
    name: string;
    sourceType: string;
    targetType: string;
    properties?: Array<{ name: string; type: string }>;
  }>;
  constraints?: OntologyConstraints;
}

export interface OntologyConstraints {
  maxNodesPerType?: Record<string, number>;
  requiredEdges?: Array<{ sourceType: string; edgeType: string; targetType: string }>;
  uniqueProperties?: Array<{ nodeType: string; property: string }>;
}

export interface OntologyFilters {
  ontologyType?: string;
  isActive?: boolean;
  isPredefined?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GraphData {
  nodes: Array<{ id: string; type: string; properties: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; type: string }>;
}
