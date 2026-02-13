# Agent W16-03: Ontology Service Builder

## Role
Build the Cognee ontology management service with predefined financial/tax/relationship ontologies, ontology application to datasets, and graph structure validation.

## Priority: WAVE 16 (After W16-01 completes schema)

## Wait Condition
Check for `.agent-done-W16-01` marker file before starting.

## Context
- Cognee ontology API: POST /v1/datasets/{name}/ontology -- applies graph schema
- Schema: `graphSchemas` table (from W16-01)
- Graph structure: node_types define entities, edge_types define relationships between entities
- Predefined ontologies: Financial, Tax, Relationship

## Files to CREATE

### 1. `server/src/services/cognee-ontologies.ts`
**Purpose**: Manage Cognee graph ontologies (node types, edge types, constraints)
**Pattern**: Follow `server/src/services/cognee-datapoints.ts`

- [ ] Create `CogneeOntologyService` class with the following methods:

  - `defineOntology(userId: string, definition: OntologyDefinition): Promise<GraphSchema>` -- Creates new ontology in DB. Validates node_types and edge_types structure. Ensures edge source/target types exist in node_types. Returns persisted schema.
    ```typescript
    interface OntologyDefinition {
      name: string;
      description?: string;
      ontologyType: 'financial' | 'tax' | 'relationship' | 'compliance' | 'merchant' | 'custom';
      nodeTypes: Array<{
        name: string;
        properties: Array<{ name: string; type: string; required?: boolean }>;
        color?: string; // hex color for graph viz
      }>;
      edgeTypes: Array<{
        name: string;
        sourceType: string; // must match a nodeType name
        targetType: string; // must match a nodeType name
        properties?: Array<{ name: string; type: string }>;
      }>;
      constraints?: OntologyConstraints;
    }
    interface OntologyConstraints {
      maxNodesPerType?: Record<string, number>;
      requiredEdges?: Array<{ sourceType: string; edgeType: string; targetType: string }>;
      uniqueProperties?: Array<{ nodeType: string; property: string }>;
    }
    ```

  - `applyToDataset(ontologyId: string, datasetName: string): Promise<void>` -- Sends ontology to Cognee API: `POST /v1/datasets/{datasetName}/ontology` with node/edge type definitions. Updates `applied_datasets` JSON array in DB. Triggers cognify with ontology-aware prompt.

  - `listOntologies(userId: string, filters?: OntologyFilters): Promise<GraphSchema[]>` -- Queries graphSchemas table with optional filters: `{ ontologyType?, isActive?, isPredefined? }`. Returns list sorted by name. Includes predefined system ontologies.

  - `getOntology(ontologyId: string): Promise<GraphSchema>` -- Single ontology by ID with full node/edge types.

  - `updateOntology(ontologyId: string, updates: Partial<OntologyDefinition>): Promise<GraphSchema>` -- Updates mutable fields. Increments version number. Cannot modify predefined ontologies. Re-applies to datasets if node/edge types changed.

  - `deactivateOntology(ontologyId: string): Promise<void>` -- Sets `is_active = false`. Does not remove from applied datasets.

  - `validateGraph(ontologyId: string, graphData: GraphData): Promise<ValidationResult>` -- Validates graph data against ontology constraints. Checks: all nodes have valid type, all edges connect valid source/target types, required edges present, unique constraints satisfied. Returns: `{ valid: boolean; errors: string[]; warnings: string[] }`.

- [ ] Define predefined ontologies as constants:
  ```typescript
  const PREDEFINED_ONTOLOGIES = {
    financial: {
      name: 'Financial Ontology',
      ontologyType: 'financial' as const,
      nodeTypes: [
        { name: 'Account', properties: [{ name: 'account_number', type: 'string' }, { name: 'account_type', type: 'string' }, { name: 'balance', type: 'number' }], color: '#FFCC00' },
        { name: 'Transaction', properties: [{ name: 'amount', type: 'number' }, { name: 'date', type: 'date' }, { name: 'category', type: 'string' }], color: '#4CAF50' },
        { name: 'Merchant', properties: [{ name: 'name', type: 'string' }, { name: 'abn', type: 'string' }, { name: 'industry', type: 'string' }], color: '#2196F3' },
        { name: 'Category', properties: [{ name: 'name', type: 'string' }, { name: 'parent', type: 'string' }, { name: 'tax_deductible', type: 'boolean' }], color: '#9C27B0' },
      ],
      edgeTypes: [
        { name: 'BELONGS_TO', sourceType: 'Transaction', targetType: 'Account' },
        { name: 'PAID_TO', sourceType: 'Transaction', targetType: 'Merchant' },
        { name: 'CATEGORIZED_AS', sourceType: 'Transaction', targetType: 'Category' },
        { name: 'CHILD_OF', sourceType: 'Category', targetType: 'Category' },
        { name: 'OPERATES_IN', sourceType: 'Merchant', targetType: 'Category' },
      ],
    },
    tax: {
      name: 'Tax Ontology',
      ontologyType: 'tax' as const,
      nodeTypes: [
        { name: 'TaxEntity', properties: [{ name: 'entity_type', type: 'string' }, { name: 'abn', type: 'string' }, { name: 'tfn', type: 'string' }], color: '#F44336' },
        { name: 'TaxObligation', properties: [{ name: 'type', type: 'string' }, { name: 'period', type: 'string' }, { name: 'amount', type: 'number' }], color: '#FF9800' },
        { name: 'Deduction', properties: [{ name: 'category', type: 'string' }, { name: 'amount', type: 'number' }, { name: 'substantiated', type: 'boolean' }], color: '#8BC34A' },
        { name: 'ATORuling', properties: [{ name: 'reference', type: 'string' }, { name: 'topic', type: 'string' }, { name: 'date', type: 'date' }], color: '#607D8B' },
      ],
      edgeTypes: [
        { name: 'OWES', sourceType: 'TaxEntity', targetType: 'TaxObligation' },
        { name: 'CLAIMS', sourceType: 'TaxEntity', targetType: 'Deduction' },
        { name: 'GOVERNED_BY', sourceType: 'Deduction', targetType: 'ATORuling' },
        { name: 'APPLIES_TO', sourceType: 'ATORuling', targetType: 'TaxObligation' },
      ],
    },
    relationship: {
      name: 'Relationship Ontology',
      ontologyType: 'relationship' as const,
      nodeTypes: [
        { name: 'Business', properties: [{ name: 'name', type: 'string' }, { name: 'abn', type: 'string' }, { name: 'industry', type: 'string' }], color: '#3F51B5' },
        { name: 'Person', properties: [{ name: 'name', type: 'string' }, { name: 'role', type: 'string' }], color: '#00BCD4' },
        { name: 'Service', properties: [{ name: 'name', type: 'string' }, { name: 'category', type: 'string' }, { name: 'recurring', type: 'boolean' }], color: '#CDDC39' },
      ],
      edgeTypes: [
        { name: 'EMPLOYS', sourceType: 'Business', targetType: 'Person' },
        { name: 'PROVIDES', sourceType: 'Business', targetType: 'Service' },
        { name: 'CONSUMES', sourceType: 'Business', targetType: 'Service' },
        { name: 'PARTNER_OF', sourceType: 'Business', targetType: 'Business' },
        { name: 'DIRECTOR_OF', sourceType: 'Person', targetType: 'Business' },
      ],
    },
  };
  ```

- [ ] Wire Drizzle ORM queries against `graphSchemas` table (from schema.ts)

## Files to MODIFY

None -- standalone service.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `CogneeOntologyService` can be instantiated without errors
- [ ] `defineOntology()` validates edge source/target types exist in node_types
- [ ] `applyToDataset()` calls Cognee API with correct body
- [ ] `listOntologies()` returns predefined + user ontologies
- [ ] `validateGraph()` correctly identifies invalid edge connections
- [ ] 3 predefined ontologies (financial, tax, relationship) are correctly defined
- [ ] Create marker file: `.agent-done-W16-03`

## Dependencies
- **Requires**: W16-01 (`.agent-done-W16-01`) -- graphSchemas table must exist in schema
- **Reuses**: schema.ts (graphSchemas), cognee_client.ts (HTTP methods)
