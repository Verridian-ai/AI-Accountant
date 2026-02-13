/**
 * Vercel AI SDK — Merchant Intelligence Agent
 *
 * Drop-in replacement for MerchantIntelligenceAgent (legacy ClaudeAgent)
 * using the Vercel AI SDK with Zod structured output.
 */

import { VercelAgent } from '../../vercel-agent.js';
import { adaptLegacyTool } from '../../tool-adapter.js';
import { MerchantIntelligenceOutputSchema } from '../../schemas/merchant-output.js';
import { cogneeTools } from '../../cognee-tools.js';
import type { MerchantIntelligenceInput, MerchantIntelligenceOutput } from '../../types.js';
import type { ToolSet } from 'ai';

/** Common merchant abbreviation patterns */
const KNOWN_MERCHANTS: Record<
  string,
  { canonical: string; industry: string; gst: boolean; category: string }
> = {
  woolworths: {
    canonical: 'Woolworths Group Ltd',
    industry: 'Retail - Grocery',
    gst: true,
    category: 'Groceries & Supermarkets',
  },
  coles: {
    canonical: 'Coles Group Ltd',
    industry: 'Retail - Grocery',
    gst: true,
    category: 'Groceries & Supermarkets',
  },
  aldi: {
    canonical: 'ALDI Stores Australia',
    industry: 'Retail - Grocery',
    gst: true,
    category: 'Groceries & Supermarkets',
  },
  bunnings: {
    canonical: 'Bunnings Group Ltd',
    industry: 'Retail - Hardware',
    gst: true,
    category: 'Home & Garden',
  },
  kmart: {
    canonical: 'Kmart Australia Ltd',
    industry: 'Retail - Department Store',
    gst: true,
    category: 'Shopping & Retail',
  },
  target: {
    canonical: 'Target Australia Pty Ltd',
    industry: 'Retail - Department Store',
    gst: true,
    category: 'Shopping & Retail',
  },
  officeworks: {
    canonical: 'Officeworks Superstores Pty Ltd',
    industry: 'Retail - Office Supplies',
    gst: true,
    category: 'Office Supplies',
  },
  'jb hi-fi': {
    canonical: 'JB Hi-Fi Group Pty Ltd',
    industry: 'Retail - Electronics',
    gst: true,
    category: 'Electronics & Technology',
  },
  telstra: {
    canonical: 'Telstra Corporation Ltd',
    industry: 'Telecommunications',
    gst: true,
    category: 'Phone & Internet',
  },
  optus: {
    canonical: 'Singtel Optus Pty Ltd',
    industry: 'Telecommunications',
    gst: true,
    category: 'Phone & Internet',
  },
  netflix: {
    canonical: 'Netflix International B.V.',
    industry: 'Digital Entertainment',
    gst: true,
    category: 'Subscriptions & Streaming',
  },
  spotify: {
    canonical: 'Spotify AB',
    industry: 'Digital Entertainment',
    gst: true,
    category: 'Subscriptions & Streaming',
  },
  uber: {
    canonical: 'Uber Australia Pty Ltd',
    industry: 'Transport/Food Delivery',
    gst: true,
    category: 'Transport & Rideshare',
  },
  mcdonald: {
    canonical: "McDonald's Australia Ltd",
    industry: 'Food & Beverage',
    gst: true,
    category: 'Dining & Restaurants',
  },
  shell: {
    canonical: 'Shell Company of Australia',
    industry: 'Fuel & Energy',
    gst: true,
    category: 'Fuel & Auto',
  },
  'bp ': {
    canonical: 'BP Australia Pty Ltd',
    industry: 'Fuel & Energy',
    gst: true,
    category: 'Fuel & Auto',
  },
  caltex: {
    canonical: 'Ampol Ltd (formerly Caltex)',
    industry: 'Fuel & Energy',
    gst: true,
    category: 'Fuel & Auto',
  },
  ampol: { canonical: 'Ampol Ltd', industry: 'Fuel & Energy', gst: true, category: 'Fuel & Auto' },
  bizloan: {
    canonical: 'BizLoan Pty Ltd',
    industry: 'Financial Services - Lending',
    gst: false,
    category: 'Business Income',
  },
  bizlend: {
    canonical: 'BizLend Finance',
    industry: 'Financial Services - Lending',
    gst: false,
    category: 'Business Income',
  },
  '7-eleven': {
    canonical: '7-Eleven Stores Pty Ltd',
    industry: 'Retail - Convenience',
    gst: true,
    category: 'Groceries',
  },
  'harvey norman': {
    canonical: 'Harvey Norman Holdings Ltd',
    industry: 'Retail - Electronics',
    gst: true,
    category: 'Computer & IT',
  },
  'the reject shop': {
    canonical: 'The Reject Shop Ltd',
    industry: 'Retail - Discount',
    gst: true,
    category: 'Miscellaneous',
  },
  'big w': {
    canonical: 'Big W (Woolworths Group)',
    industry: 'Retail - Department Store',
    gst: true,
    category: 'Miscellaneous',
  },
  kfc: {
    canonical: 'KFC Australia Pty Ltd',
    industry: 'Food & Beverage',
    gst: true,
    category: 'Dining & Takeaway',
  },
  'hungry jacks': {
    canonical: "Hungry Jack's Pty Ltd",
    industry: 'Food & Beverage',
    gst: true,
    category: 'Dining & Takeaway',
  },
  nando: {
    canonical: "Nando's Australia Pty Ltd",
    industry: 'Food & Beverage',
    gst: true,
    category: 'Dining & Takeaway',
  },
};

/** Square POS prefix patterns */
const SQUARE_PATTERN = /^SQ \*/i;
/** Stripe prefix */
const STRIPE_PATTERN = /^STRIPE/i;
/** PayPal prefix */
const PAYPAL_PATTERN = /^PAYPAL \*/i;

const SYSTEM_PROMPT = `You are an Australian merchant intelligence specialist. Your job is to resolve abbreviated bank statement merchant descriptions into canonical business names, determine their GST registration status, and infer appropriate transaction categories.

You work with Australian bank statement data where merchant names are often abbreviated, truncated, or use payment processor prefixes like "SQ *" (Square), "STRIPE", "PAYPAL *".

Your workflow:
1. Use search_cognee_merchant to check if we already know this merchant
2. Use resolve_merchant_name to identify the full business name from abbreviations
3. Use lookup_abn to check GST registration via the Australian Business Register
4. Use infer_category to determine the likely transaction category
5. Use store_merchant_mapping to save new mappings for future use

For each merchant, determine:
- Canonical (full) business name
- ABN (if available)
- GST registration status (most Australian businesses with turnover > $75K are registered)
- Industry classification
- Default transaction category

Return a JSON object matching the MerchantIntelligenceOutput schema.`;

export class VercelMerchantIntelligence extends VercelAgent<
  MerchantIntelligenceInput,
  MerchantIntelligenceOutput
> {
  constructor() {
    super('merchant_intelligence', SYSTEM_PROMPT, MerchantIntelligenceOutputSchema);
  }

  getTools(): ToolSet {
    const tools: ToolSet = {};

    tools['search_cognee_merchant'] = adaptLegacyTool(
      'search_cognee_merchant',
      'Search Cognee knowledge graph for previously learned merchant mappings.',
      {
        type: 'object',
        properties: {
          merchantName: {
            type: 'string',
            description: 'The abbreviated merchant name from the bank statement',
          },
        },
        required: ['merchantName'],
      },
      async (input) => {
        const name = input.merchantName as string;
        const results = await cogneeTools.search(
          `merchant mapping for "${name}"`,
          'merchant_mappings',
          'CHUNKS_LEXICAL',
        );
        return { found: results.length > 0, results };
      },
    );

    tools['resolve_merchant_name'] = adaptLegacyTool(
      'resolve_merchant_name',
      'Resolve an abbreviated merchant name to its canonical business name using known patterns and heuristics.',
      {
        type: 'object',
        properties: {
          abbreviatedName: {
            type: 'string',
            description: 'Abbreviated merchant name from bank statement',
          },
          amount: {
            type: 'number',
            description: 'Transaction amount in cents (helps infer merchant type)',
          },
        },
        required: ['abbreviatedName'],
      },
      async (input) => {
        const abbreviated = (input.abbreviatedName as string).trim();
        const lowerDesc = abbreviated.toLowerCase();

        for (const [key, info] of Object.entries(KNOWN_MERCHANTS)) {
          if (lowerDesc.includes(key)) {
            return {
              resolved: true,
              canonicalName: info.canonical,
              industry: info.industry,
              gstRegistered: info.gst,
              defaultCategory: info.category,
              source: 'pattern',
            };
          }
        }

        let cleanName = abbreviated;
        if (SQUARE_PATTERN.test(cleanName)) {
          cleanName = cleanName.replace(SQUARE_PATTERN, '').trim();
          return {
            resolved: false,
            cleanedName: cleanName,
            hint: 'Square POS merchant — likely small business, GST status uncertain',
            source: 'prefix_stripped',
          };
        }
        if (STRIPE_PATTERN.test(cleanName)) {
          cleanName = cleanName.replace(STRIPE_PATTERN, '').trim();
          return {
            resolved: false,
            cleanedName: cleanName,
            hint: 'Stripe payment — likely online business',
            source: 'prefix_stripped',
          };
        }
        if (PAYPAL_PATTERN.test(cleanName)) {
          cleanName = cleanName.replace(PAYPAL_PATTERN, '').trim();
          return {
            resolved: false,
            cleanedName: cleanName,
            hint: 'PayPal payment — check if Australian or international',
            source: 'prefix_stripped',
          };
        }

        return {
          resolved: false,
          cleanedName: cleanName,
          hint: 'Unknown merchant — use lookup_abn or infer from context',
          source: 'unknown',
        };
      },
    );

    tools['lookup_abn'] = adaptLegacyTool(
      'lookup_abn',
      'Look up a business on the Australian Business Register to check ABN and GST registration.',
      {
        type: 'object',
        properties: {
          businessName: { type: 'string', description: 'Business name to search for' },
        },
        required: ['businessName'],
      },
      async (input) => {
        const businessName = input.businessName as string;
        const lowerName = businessName.toLowerCase();

        const likelyGstRegistered =
          lowerName.includes('pty ltd') ||
          lowerName.includes('ltd') ||
          lowerName.includes('group') ||
          lowerName.includes('australia') ||
          lowerName.includes('holdings');

        return {
          businessName,
          abnFound: false,
          gstRegistered: likelyGstRegistered,
          hint: likelyGstRegistered
            ? 'Business name suggests a registered entity — likely GST registered'
            : 'Could not verify GST registration — assume GST-inclusive for established businesses',
        };
      },
    );

    tools['infer_category'] = adaptLegacyTool(
      'infer_category',
      'Infer the transaction category based on merchant name, industry, and amount.',
      {
        type: 'object',
        properties: {
          merchantName: { type: 'string', description: 'Merchant name' },
          industry: { type: 'string', description: 'Industry classification' },
          amount: { type: 'number', description: 'Transaction amount in cents' },
          description: { type: 'string', description: 'Full transaction description' },
        },
        required: ['merchantName'],
      },
      async (input) => {
        const name = ((input.merchantName as string) || '').toLowerCase();
        const industry = ((input.industry as string) || '').toLowerCase();
        const amount = (input.amount as number) || 0;

        if (
          industry.includes('fuel') ||
          name.includes('petrol') ||
          name.includes('fuel') ||
          name.includes('bp ') ||
          name.includes('shell') ||
          name.includes('caltex') ||
          name.includes('ampol')
        ) {
          return { category: 'Fuel & Auto', confidence: 0.9 };
        }
        if (
          industry.includes('grocery') ||
          name.includes('woolworths') ||
          name.includes('coles') ||
          name.includes('aldi') ||
          name.includes('iga')
        ) {
          return { category: 'Groceries & Supermarkets', confidence: 0.9 };
        }
        if (
          industry.includes('telecom') ||
          name.includes('telstra') ||
          name.includes('optus') ||
          name.includes('vodafone')
        ) {
          return { category: 'Phone & Internet', confidence: 0.9 };
        }
        if (
          industry.includes('food') ||
          name.includes('cafe') ||
          name.includes('restaurant') ||
          name.includes('pizza') ||
          name.includes('sushi')
        ) {
          return { category: 'Dining & Restaurants', confidence: 0.8 };
        }
        if (name.includes('uber eats') || name.includes('doordash') || name.includes('menulog')) {
          return { category: 'Food Delivery', confidence: 0.9 };
        }
        if (name.includes('uber') || name.includes('didi') || name.includes('ola')) {
          return { category: 'Transport & Rideshare', confidence: 0.85 };
        }
        if (
          industry.includes('insurance') ||
          name.includes('insurance') ||
          name.includes('nrma') ||
          name.includes('allianz')
        ) {
          return { category: 'Insurance', confidence: 0.85 };
        }
        if (Math.abs(amount) > 500000) {
          return { category: 'Large Purchase', confidence: 0.5 };
        }

        return { category: 'General Expenses', confidence: 0.3 };
      },
    );

    tools['store_merchant_mapping'] = adaptLegacyTool(
      'store_merchant_mapping',
      'Store a new merchant mapping in Cognee for future reference.',
      {
        type: 'object',
        properties: {
          abbreviatedName: { type: 'string', description: 'Abbreviated name from bank statement' },
          canonicalName: { type: 'string', description: 'Full canonical business name' },
          abn: { type: 'string', description: 'Australian Business Number (optional)' },
          gstRegistered: { type: 'boolean', description: 'Whether the business is GST registered' },
          industry: { type: 'string', description: 'Industry classification' },
          defaultCategory: { type: 'string', description: 'Default transaction category' },
        },
        required: ['abbreviatedName', 'canonicalName', 'gstRegistered', 'defaultCategory'],
      },
      async (input) => {
        const abbreviated = input.abbreviatedName as string;
        const canonical = input.canonicalName as string;
        const abn = input.abn as string | undefined;
        const gst = input.gstRegistered as boolean;
        const industry = input.industry as string | undefined;
        const category = input.defaultCategory as string;

        const mappingText = `Merchant Mapping: "${abbreviated}" → "${canonical}", ABN: ${abn || 'N/A'}, GST: ${gst ? 'Yes' : 'No'}, Industry: ${industry || 'Unknown'}, Category: ${category}`;

        await cogneeTools.index([mappingText], 'merchant_mappings');

        return { stored: true, mapping: { abbreviated, canonical, abn, gst, industry, category } };
      },
    );

    tools['explore_merchant_graph'] = adaptLegacyTool(
      'explore_merchant_graph',
      'Explore knowledge graph for merchant business relationships and patterns using DataPoint-structured entity matching.',
      {
        type: 'object',
        properties: {
          merchantName: {
            type: 'string',
            description: 'Merchant name to explore in the knowledge graph',
          },
        },
        required: ['merchantName'],
      },
      async (input) => {
        const merchantName = input.merchantName as string;
        const results = await cogneeTools.searchWithDataPoint(merchantName, 'BusinessRelationship');
        return { relationships: results.length > 0 ? results : [], count: results.length };
      },
    );

    tools['get_merchant_ontology_context'] = adaptLegacyTool(
      'get_merchant_ontology_context',
      'Get ontology-based relationship context for a merchant, including industry connections and related entities.',
      {
        type: 'object',
        properties: {
          merchantName: { type: 'string', description: 'Merchant name to look up in the ontology' },
        },
        required: ['merchantName'],
      },
      async (input) => {
        const merchantName = input.merchantName as string;
        const results = await cogneeTools.searchWithOntology(merchantName, 'relationship');
        return { context: results.length > 0 ? results : [], count: results.length };
      },
    );

    tools['merchant_timeline'] = adaptLegacyTool(
      'merchant_timeline',
      'Build merchant activity timeline showing payment frequency and amount trends over a specified number of months.',
      {
        type: 'object',
        properties: {
          merchantName: { type: 'string', description: 'Merchant name to search timeline for' },
          months: { type: 'number', description: 'Number of months to look back' },
        },
        required: ['merchantName', 'months'],
      },
      async (input) => {
        const merchantName = input.merchantName as string;
        const months = input.months as number;
        const now = new Date();
        const start = new Date(now);
        start.setMonth(start.getMonth() - months);
        try {
          const results = await cogneeTools.searchTimeline(
            merchantName,
            { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) },
            ['transactions'],
          );
          return { timeline: results.length > 0 ? results : [], count: results.length, months };
        } catch {
          return { timeline: [], count: 0, error: 'Timeline search unavailable' };
        }
      },
    );

    tools['batch_resolve'] = adaptLegacyTool(
      'batch_resolve',
      'Batch resolve multiple merchants at once using pattern matching.',
      {
        type: 'object',
        properties: {
          merchants: {
            type: 'array',
            description: 'Array of merchants with id, description, amount',
          },
        },
        required: ['merchants'],
      },
      async (input) => {
        const merchants = input.merchants as Array<{
          id: number;
          description: string;
          amount: number;
        }>;

        return merchants.map((m) => {
          const lowerDesc = m.description.toLowerCase();

          for (const [key, info] of Object.entries(KNOWN_MERCHANTS)) {
            if (lowerDesc.includes(key)) {
              return {
                transactionId: m.id,
                resolved: true,
                canonicalName: info.canonical,
                industry: info.industry,
                gstRegistered: info.gst,
                defaultCategory: info.category,
                confidence: 0.95,
                source: 'pattern',
              };
            }
          }

          return {
            transactionId: m.id,
            resolved: false,
            canonicalName: m.description,
            industry: 'Unknown',
            gstRegistered: true,
            defaultCategory: 'General Expenses',
            confidence: 0.3,
            source: 'unknown',
          };
        });
      },
    );

    return tools;
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
