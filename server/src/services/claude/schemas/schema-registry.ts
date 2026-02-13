/**
 * SchemaRegistry — Central registry for all agent output Zod schemas.
 *
 * Provides runtime validation of agent outputs, schema lookup by agent type,
 * and a default initialization that registers all 8 built-in schemas.
 */
import { z } from 'zod';
import type { AgentType } from '../types.js';

import { CategorizerOutputSchema } from './categorizer-output.js';
import { BudgetAnalyzerOutputSchema } from './budget-output.js';
import { GSTCalculatorOutputSchema } from './gst-output.js';
import { TaxStrategyOutputSchema } from './tax-strategy-output.js';
import { MerchantIntelligenceOutputSchema } from './merchant-output.js';
import { ReconcilerOutputSchema } from './reconciler-output.js';
import { StatementParserOutputSchema } from './parser-output.js';
import { FinancialPlannerOutputSchema } from './planner-output.js';

interface SchemaEntry {
  schema: z.ZodSchema;
  name: string;
  version: number;
}

export class SchemaRegistry {
  private schemas = new Map<string, SchemaEntry>();

  /**
   * Register a Zod schema for an agent type.
   */
  registerSchema(agentType: AgentType, schema: z.ZodSchema, name: string, version = 1): void {
    this.schemas.set(agentType, { schema, name, version });
  }

  /**
   * Retrieve the Zod schema for a given agent type, or null if not registered.
   */
  getSchema(agentType: AgentType): z.ZodSchema | null {
    return this.schemas.get(agentType)?.schema ?? null;
  }

  /**
   * Validate an agent's output against its registered schema.
   * Returns { valid: true } on success, or { valid: false, errors } on failure.
   */
  validateOutput(agentType: AgentType, output: unknown): { valid: boolean; errors?: z.ZodError } {
    const entry = this.schemas.get(agentType);
    if (!entry) {
      return { valid: true }; // No schema registered — pass-through
    }

    const result = entry.schema.safeParse(output);
    if (result.success) {
      return { valid: true };
    }
    return { valid: false, errors: result.error };
  }

  /**
   * List all registered schemas with their metadata.
   */
  listSchemas(): Array<{ agentType: string; name: string; version: number }> {
    const entries: Array<{ agentType: string; name: string; version: number }> = [];
    for (const [agentType, entry] of this.schemas) {
      entries.push({ agentType, name: entry.name, version: entry.version });
    }
    return entries;
  }

  /**
   * Track validation pass/fail stats. No-op for now — DB write deferred to later wave.
   */
  updateStats(_agentType: AgentType, _passed: boolean): void {
    // Will be wired to output_schemas table in a future wave
  }

  /**
   * Register all 8 built-in agent output schemas.
   */
  initializeDefaults(): void {
    this.registerSchema('transaction_categorizer', CategorizerOutputSchema, 'CategorizerOutput', 1);
    this.registerSchema('budget_analyzer', BudgetAnalyzerOutputSchema, 'BudgetAnalyzerOutput', 1);
    this.registerSchema('gst_calculator', GSTCalculatorOutputSchema, 'GSTCalculatorOutput', 1);
    this.registerSchema('tax_strategy', TaxStrategyOutputSchema, 'TaxStrategyOutput', 1);
    this.registerSchema('merchant_intelligence', MerchantIntelligenceOutputSchema, 'MerchantIntelligenceOutput', 1);
    this.registerSchema('account_reconciler', ReconcilerOutputSchema, 'ReconcilerOutput', 1);
    this.registerSchema('statement_parser', StatementParserOutputSchema, 'StatementParserOutput', 1);
    this.registerSchema('financial_planner', FinancialPlannerOutputSchema, 'FinancialPlannerOutput', 1);
  }
}

/** Singleton instance with all defaults pre-loaded. */
export const schemaRegistry = new SchemaRegistry();
schemaRegistry.initializeDefaults();
