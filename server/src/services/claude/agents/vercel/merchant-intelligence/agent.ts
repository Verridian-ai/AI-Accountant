/**
 * Vercel AI SDK — Merchant Intelligence Agent
 *
 * Drop-in replacement for MerchantIntelligenceAgent (legacy ClaudeAgent)
 * using the Vercel AI SDK with Zod structured output.
 */

import { VercelAgent } from '../../../vercel-agent.js';
import { MerchantIntelligenceOutputSchema } from '../../../schemas/merchant-output.js';
import type { MerchantIntelligenceInput, MerchantIntelligenceOutput } from '../../../types.js';
import type { ToolSet } from 'ai';
import { SYSTEM_PROMPT } from './constants.js';
import { buildMerchantIntelligenceTools } from './tools.js';

export class VercelMerchantIntelligence extends VercelAgent<
  MerchantIntelligenceInput,
  MerchantIntelligenceOutput
> {
  constructor() {
    super('merchant_intelligence', SYSTEM_PROMPT, MerchantIntelligenceOutputSchema);
  }

  getTools(sessionId?: string): ToolSet {
    return buildMerchantIntelligenceTools(sessionId);
  }

  buildPrompt(input: MerchantIntelligenceInput): string {
    const parts = [
      `Resolve ${input.merchants.length} merchant names from bank statement data.`,
      input.existingMappings.length > 0
        ? `Existing known mappings (${input.existingMappings.length}): ${JSON.stringify(input.existingMappings.slice(0, 50))}`
        : 'No existing merchant mappings available.',
      `Merchants to resolve:`,
      JSON.stringify(input.merchants, null, 2),
    ];

    return parts.join('\n\n');
  }

  protected override buildFallbackOutput(
    input: MerchantIntelligenceInput,
    _error: unknown,
  ): MerchantIntelligenceOutput {
    return {
      results: input.merchants.map((m) => ({
        transactionId: m.transactionId,
        abbreviatedName: m.description,
        canonicalName: m.description,
        gstRegistered: true,
        defaultCategory: m.category ?? 'General Expenses',
        confidence: 0,
        source: 'unknown' as const,
      })),
      newMappings: [],
      summary: 'Fallback: Vercel merchant intelligence agent execution failed.',
    };
  }
}
