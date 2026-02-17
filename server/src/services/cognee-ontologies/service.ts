/** Cognee Ontology Management Service — CRUD for graph ontologies. */

import { db, graphSchemas } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { cogneeClient } from '../cognee_client.js';
import crypto from 'crypto';
import type {
  OntologyDefinition,
  OntologyConstraints,
  OntologyFilters,
  ValidationResult,
  GraphData,
} from './types.js';
import { PREDEFINED_ONTOLOGIES } from './constants.js';

export class CogneeOntologyService {
  async defineOntology(userId: string, definition: OntologyDefinition) {
    const nodeTypeNames = new Set(definition.nodeTypes.map((n) => n.name));
    for (const edge of definition.edgeTypes) {
      if (!nodeTypeNames.has(edge.sourceType))
        throw new Error(`Edge "${edge.name}" references unknown source type "${edge.sourceType}"`);
      if (!nodeTypeNames.has(edge.targetType))
        throw new Error(`Edge "${edge.name}" references unknown target type "${edge.targetType}"`);
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .insert(graphSchemas)
      .values({
        id,
        userId,
        name: definition.name,
        description: definition.description ?? null,
        ontologyType: definition.ontologyType,
        nodeTypes: JSON.stringify(definition.nodeTypes),
        edgeTypes: JSON.stringify(definition.edgeTypes),
        constraints: definition.constraints ? JSON.stringify(definition.constraints) : null,
        isActive: true,
        isPredefined: false,
        appliedDatasets: JSON.stringify([]),
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return this.getOntology(id);
  }

  async applyToDataset(ontologyId: string, datasetName: string, userId?: string) {
    const ontology = await this.getOntology(ontologyId);
    if (!ontology) throw new Error(`Ontology ${ontologyId} not found`);
    const nodeTypes = JSON.parse(ontology.nodeTypes) as OntologyDefinition['nodeTypes'];
    const edgeTypes = JSON.parse(ontology.edgeTypes) as OntologyDefinition['edgeTypes'];
    const nodeDesc = nodeTypes
      .map((n) => `${n.name} (${n.properties.map((p) => p.name).join(', ')})`)
      .join('; ');
    const edgeDesc = edgeTypes
      .map((e) => `${e.sourceType} -[${e.name}]-> ${e.targetType}`)
      .join('; ');
    const customPrompt =
      `Extract entities matching this ontology. Node types: ${nodeDesc}. ` +
      `Relationships: ${edgeDesc}. ` +
      `Focus on identifying these specific entity types and their relationships in the financial data.`;
    await cogneeClient.cognify([datasetName], true, customPrompt, userId);
    const currentDatasets: string[] = ontology.appliedDatasets
      ? JSON.parse(ontology.appliedDatasets)
      : [];
    if (!currentDatasets.includes(datasetName)) currentDatasets.push(datasetName);
    const now = new Date().toISOString();
    await db
      .update(graphSchemas)
      .set({ appliedDatasets: JSON.stringify(currentDatasets), updatedAt: now })
      .where(eq(graphSchemas.id, ontologyId))
      .run();
    return { ontologyId, datasetName, appliedDatasets: currentDatasets };
  }

  async listOntologies(userId: string, filters?: OntologyFilters) {
    await this.ensurePredefinedOntologies(userId);
    let query = db.select().from(graphSchemas);
    const conditions: any[] = [];
    if (filters?.ontologyType) conditions.push(eq(graphSchemas.ontologyType, filters.ontologyType));
    if (filters?.isActive !== undefined)
      conditions.push(eq(graphSchemas.isActive, filters.isActive));
    if (filters?.isPredefined !== undefined)
      conditions.push(eq(graphSchemas.isPredefined, filters.isPredefined));
    if (conditions.length > 0) {
      query = query.where(and(eq(graphSchemas.userId, userId), ...conditions)) as any;
    } else {
      query = query.where(eq(graphSchemas.userId, userId)) as any;
    }
    const results = await (query as any).all();
    return (results as any[]).sort((a: any, b: any) =>
      (a.name as string).localeCompare(b.name as string),
    );
  }

  async getOntology(ontologyId: string) {
    return db.select().from(graphSchemas).where(eq(graphSchemas.id, ontologyId)).get();
  }

  async updateOntology(
    ontologyId: string,
    updates: Partial<
      Pick<OntologyDefinition, 'name' | 'description' | 'nodeTypes' | 'edgeTypes' | 'constraints'>
    >,
  ) {
    const existing = await this.getOntology(ontologyId);
    if (!existing) throw new Error(`Ontology ${ontologyId} not found`);
    if (existing.isPredefined) throw new Error('Cannot modify predefined ontologies');
    const newNodeTypes = updates.nodeTypes ?? JSON.parse(existing.nodeTypes);
    const newEdgeTypes = updates.edgeTypes ?? JSON.parse(existing.edgeTypes);
    const nodeTypeNames = new Set(newNodeTypes.map((n: any) => n.name));
    for (const edge of newEdgeTypes) {
      if (!nodeTypeNames.has(edge.sourceType))
        throw new Error(`Edge "${edge.name}" references unknown source type "${edge.sourceType}"`);
      if (!nodeTypeNames.has(edge.targetType))
        throw new Error(`Edge "${edge.name}" references unknown target type "${edge.targetType}"`);
    }
    const now = new Date().toISOString();
    const typesChanged = updates.nodeTypes !== undefined || updates.edgeTypes !== undefined;
    const setValues: Record<string, any> = { version: existing.version + 1, updatedAt: now };
    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.nodeTypes !== undefined) setValues.nodeTypes = JSON.stringify(updates.nodeTypes);
    if (updates.edgeTypes !== undefined) setValues.edgeTypes = JSON.stringify(updates.edgeTypes);
    if (updates.constraints !== undefined)
      setValues.constraints = JSON.stringify(updates.constraints);
    await db.update(graphSchemas).set(setValues).where(eq(graphSchemas.id, ontologyId)).run();
    if (typesChanged) {
      const appliedDatasets: string[] = existing.appliedDatasets
        ? JSON.parse(existing.appliedDatasets)
        : [];
      for (const dataset of appliedDatasets) await this.applyToDataset(ontologyId, dataset);
    }
    return this.getOntology(ontologyId);
  }

  async deactivateOntology(ontologyId: string) {
    const existing = await this.getOntology(ontologyId);
    if (!existing) throw new Error(`Ontology ${ontologyId} not found`);
    const now = new Date().toISOString();
    await db
      .update(graphSchemas)
      .set({ isActive: false, updatedAt: now })
      .where(eq(graphSchemas.id, ontologyId))
      .run();
    return { id: ontologyId, isActive: false };
  }

  async validateGraph(ontologyId: string, graphData: GraphData): Promise<ValidationResult> {
    const ontology = await this.getOntology(ontologyId);
    if (!ontology)
      return { valid: false, errors: [`Ontology ${ontologyId} not found`], warnings: [] };
    const nodeTypes = JSON.parse(ontology.nodeTypes) as OntologyDefinition['nodeTypes'];
    const edgeTypes = JSON.parse(ontology.edgeTypes) as OntologyDefinition['edgeTypes'];
    const constraints: OntologyConstraints | null = ontology.constraints
      ? JSON.parse(ontology.constraints)
      : null;
    const errors: string[] = [];
    const warnings: string[] = [];
    const validNodeTypeNames = new Set(nodeTypes.map((n) => n.name));
    const nodeTypeLookup = new Map(nodeTypes.map((n) => [n.name, n]));
    const validEdgeSignatures = new Set(
      edgeTypes.map((e) => `${e.sourceType}|${e.name}|${e.targetType}`),
    );
    const nodeIdSet = new Set(graphData.nodes.map((n) => n.id));
    const nodeCountsByType: Record<string, number> = {};

    for (const node of graphData.nodes) {
      if (!validNodeTypeNames.has(node.type)) {
        errors.push(`Node "${node.id}" has unknown type "${node.type}"`);
        continue;
      }
      nodeCountsByType[node.type] = (nodeCountsByType[node.type] ?? 0) + 1;
      const typeDef = nodeTypeLookup.get(node.type);
      if (typeDef) {
        for (const prop of typeDef.properties) {
          if (
            prop.required &&
            (node.properties[prop.name] === undefined || node.properties[prop.name] === null)
          )
            errors.push(
              `Node "${node.id}" (${node.type}) missing required property "${prop.name}"`,
            );
        }
      }
    }
    for (const edge of graphData.edges) {
      if (!nodeIdSet.has(edge.source)) {
        errors.push(`Edge "${edge.type}" references unknown source node "${edge.source}"`);
        continue;
      }
      if (!nodeIdSet.has(edge.target)) {
        errors.push(`Edge "${edge.type}" references unknown target node "${edge.target}"`);
        continue;
      }
      const sourceNode = graphData.nodes.find((n) => n.id === edge.source);
      const targetNode = graphData.nodes.find((n) => n.id === edge.target);
      if (sourceNode && targetNode) {
        const sig = `${sourceNode.type}|${edge.type}|${targetNode.type}`;
        if (!validEdgeSignatures.has(sig))
          errors.push(
            `Edge "${edge.type}" from ${sourceNode.type} to ${targetNode.type} is not allowed by ontology`,
          );
      }
    }
    if (constraints) {
      if (constraints.maxNodesPerType) {
        for (const [type, max] of Object.entries(constraints.maxNodesPerType)) {
          const count = nodeCountsByType[type] ?? 0;
          if (count > max)
            errors.push(`Node type "${type}" has ${count} instances, max allowed is ${max}`);
        }
      }
      if (constraints.requiredEdges) {
        for (const req of constraints.requiredEdges) {
          const found = graphData.edges.some((e) => {
            const src = graphData.nodes.find((n) => n.id === e.source);
            const tgt = graphData.nodes.find((n) => n.id === e.target);
            return (
              src?.type === req.sourceType &&
              e.type === req.edgeType &&
              tgt?.type === req.targetType
            );
          });
          if (!found)
            warnings.push(
              `Required edge ${req.sourceType} -[${req.edgeType}]-> ${req.targetType} not found in graph`,
            );
        }
      }
      if (constraints.uniqueProperties) {
        for (const uq of constraints.uniqueProperties) {
          const nodesOfType = graphData.nodes.filter((n) => n.type === uq.nodeType);
          const values = nodesOfType
            .map((n) => n.properties[uq.property])
            .filter((v) => v !== undefined && v !== null);
          const uniqueValues = new Set(values.map((v) => String(v)));
          if (uniqueValues.size < values.length)
            errors.push(
              `Property "${uq.property}" on "${uq.nodeType}" must be unique but has duplicates`,
            );
        }
      }
    }
    const connectedNodeIds = new Set<string>();
    for (const edge of graphData.edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    for (const node of graphData.nodes) {
      if (!connectedNodeIds.has(node.id))
        warnings.push(`Node "${node.id}" (${node.type}) has no edges`);
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  private async ensurePredefinedOntologies(userId: string) {
    const existing = await db
      .select()
      .from(graphSchemas)
      .where(and(eq(graphSchemas.userId, userId), eq(graphSchemas.isPredefined, true)))
      .all();
    const existingNames = new Set((existing as any[]).map((r: any) => r.name));
    for (const [, def] of Object.entries(PREDEFINED_ONTOLOGIES)) {
      if (existingNames.has(def.name)) continue;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db
        .insert(graphSchemas)
        .values({
          id,
          userId,
          name: def.name,
          description: def.description,
          ontologyType: def.ontologyType,
          nodeTypes: JSON.stringify(def.nodeTypes),
          edgeTypes: JSON.stringify(def.edgeTypes),
          constraints: null,
          isActive: true,
          isPredefined: true,
          appliedDatasets: JSON.stringify([]),
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }
}

export const cogneeOntologyService = new CogneeOntologyService();
