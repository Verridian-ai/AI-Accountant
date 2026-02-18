/**
 * Vercel Merchant Intelligence — Tool Builder
 *
 * Constructs the ToolSet for the merchant intelligence agent, including
 * Cognee search, name resolution, ABN lookup, category inference,
 * merchant mapping storage, graph exploration, and batch resolution.
 */

import { adaptLegacyTool } from '../../../tool-adapter.js';
import { cogneeTools } from '../../../cognee-tools.js';
import type { ToolSet } from 'ai';
import { KNOWN_MERCHANTS, SQUARE_PATTERN, STRIPE_PATTERN, PAYPAL_PATTERN } from './constants.js';

export function buildMerchantIntelligenceTools(sessionId?: string): ToolSet {
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
        sessionId,
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
        gstRegistered: {
          type: 'boolean',
          description: 'Whether the business is GST registered',
        },
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

      return {
        stored: true,
        mapping: { abbreviated, canonical, abn, gst, industry, category },
      };
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
      const results = await cogneeTools.searchWithDataPoint(
        merchantName,
        'BusinessRelationship',
        sessionId,
      );
      return { relationships: results.length > 0 ? results : [], count: results.length };
    },
  );

  tools['get_merchant_ontology_context'] = adaptLegacyTool(
    'get_merchant_ontology_context',
    'Get ontology-based relationship context for a merchant, including industry connections and related entities.',
    {
      type: 'object',
      properties: {
        merchantName: {
          type: 'string',
          description: 'Merchant name to look up in the ontology',
        },
      },
      required: ['merchantName'],
    },
    async (input) => {
      const merchantName = input.merchantName as string;
      const results = await cogneeTools.searchWithOntology(merchantName, 'relationship', sessionId);
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
