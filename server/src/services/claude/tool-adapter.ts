/**
 * Vercel AI SDK — Tool Adapter
 *
 * Bridges the existing Anthropic SDK tool format (JSON Schema parameters +
 * separate handler map) into Vercel AI SDK tool format (Zod schema +
 * inline execute function).
 *
 * This lets us reuse every tool handler already written for the legacy
 * `ClaudeAgent` without rewriting their parameter definitions.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from 'ai';

// ---------------------------------------------------------------------------
// Single-tool adapter
// ---------------------------------------------------------------------------

/**
 * JSON Schema property descriptor as used by the Anthropic SDK tool format.
 */
interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface JsonSchemaParameters {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/**
 * Convert a single legacy Anthropic tool definition + its handler into a
 * Vercel AI SDK tool.
 *
 * Because the legacy tools use JSON Schema (not Zod) for their parameter
 * definitions, we take a pragmatic approach:
 *   - Each top-level property is mapped to `z.any()` so the LLM can pass
 *     whatever the original schema described.
 *   - The property descriptions are preserved so the model still gets
 *     contextual guidance.
 *   - Required / optional is honoured at the Zod level.
 *
 * This avoids a full JSON-Schema-to-Zod transpiler while keeping type
 * safety at the Vercel SDK boundary.
 */
export function adaptLegacyTool(
  _name: string,
  description: string,
  parameters: JsonSchemaParameters | undefined,
  handler: (input: Record<string, unknown>) => Promise<unknown>,
): ToolSet[string] {
  // Build a Zod object schema from the JSON Schema properties
  const props = parameters?.properties ?? {};
  const required = new Set(parameters?.required ?? []);

  const zodShape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(props)) {
    let field: z.ZodTypeAny = z.any();

    // Attach the description so the model prompt includes it
    if (prop.description) {
      field = field.describe(prop.description);
    }

    // Mark optional fields
    if (!required.has(key)) {
      field = field.optional();
    }

    zodShape[key] = field;
  }

  const zodSchema = Object.keys(zodShape).length > 0 ? z.object(zodShape) : z.object({});

  // Type assertion bridges the dynamically-built Zod schema to the
  // strictly-typed tool() overloads.  At runtime the schema works correctly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tool as any)({
    description,
    parameters: zodSchema,
    execute: async (args: Record<string, unknown>) => handler(args),
  });
}

// ---------------------------------------------------------------------------
// Batch adapter
// ---------------------------------------------------------------------------

/**
 * Anthropic SDK tool definition shape (subset of `Anthropic.Tool`).
 */
interface LegacyToolDefinition {
  name: string;
  description: string;
  input_schema?: JsonSchemaParameters;
}

/**
 * Convert an array of legacy Anthropic tool definitions paired with their
 * handler map into a Vercel AI SDK `ToolSet`.
 */
export function adaptAllTools(
  tools: LegacyToolDefinition[],
  handlers: Map<string, (input: Record<string, unknown>) => Promise<unknown>>,
): ToolSet {
  const result: ToolSet = {};

  for (const def of tools) {
    const handler = handlers.get(def.name);
    if (!handler) {
      console.warn(`[tool-adapter] No handler for tool "${def.name}" — skipping`);
      continue;
    }

    result[def.name] = adaptLegacyTool(def.name, def.description, def.input_schema, handler);
  }

  return result;
}
