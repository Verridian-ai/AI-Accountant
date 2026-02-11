/**
 * Merchant Intelligence Agent
 *
 * Resolves abbreviated merchant names to canonical business names,
 * looks up ABN/GST registration status, and stores mappings in Cognee
 * for continuous learning.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import type {
  MerchantIntelligenceInput,
  MerchantIntelligenceOutput,
} from '../types.js';

/** Common merchant abbreviation patterns */
const KNOWN_MERCHANTS: Record<string, { canonical: string; industry: string; gst: boolean; category: string }> = {
  'woolworths': { canonical: 'Woolworths Group Ltd', industry: 'Retail - Grocery', gst: true, category: 'Groceries & Supermarkets' },
  'coles': { canonical: 'Coles Group Ltd', industry: 'Retail - Grocery', gst: true, category: 'Groceries & Supermarkets' },
  'aldi': { canonical: 'ALDI Stores Australia', industry: 'Retail - Grocery', gst: true, category: 'Groceries & Supermarkets' },
  'bunnings': { canonical: 'Bunnings Group Ltd', industry: 'Retail - Hardware', gst: true, category: 'Home & Garden' },
  'kmart': { canonical: 'Kmart Australia Ltd', industry: 'Retail - Department Store', gst: true, category: 'Shopping & Retail' },
  'target': { canonical: 'Target Australia Pty Ltd', industry: 'Retail - Department Store', gst: true, category: 'Shopping & Retail' },
  'officeworks': { canonical: 'Officeworks Superstores Pty Ltd', industry: 'Retail - Office Supplies', gst: true, category: 'Office Supplies' },
  'jb hi-fi': { canonical: 'JB Hi-Fi Group Pty Ltd', industry: 'Retail - Electronics', gst: true, category: 'Electronics & Technology' },
  'telstra': { canonical: 'Telstra Corporation Ltd', industry: 'Telecommunications', gst: true, category: 'Phone & Internet' },
  'optus': { canonical: 'Singtel Optus Pty Ltd', industry: 'Telecommunications', gst: true, category: 'Phone & Internet' },
  'netflix': { canonical: 'Netflix International B.V.', industry: 'Digital Entertainment', gst: true, category: 'Subscriptions & Streaming' },
  'spotify': { canonical: 'Spotify AB', industry: 'Digital Entertainment', gst: true, category: 'Subscriptions & Streaming' },
  'uber': { canonical: 'Uber Australia Pty Ltd', industry: 'Transport/Food Delivery', gst: true, category: 'Transport & Rideshare' },
  'mcdonald': { canonical: "McDonald's Australia Ltd", industry: 'Food & Beverage', gst: true, category: 'Dining & Restaurants' },
  'shell': { canonical: 'Shell Company of Australia', industry: 'Fuel & Energy', gst: true, category: 'Fuel & Auto' },
  'bp ': { canonical: 'BP Australia Pty Ltd', industry: 'Fuel & Energy', gst: true, category: 'Fuel & Auto' },
  'caltex': { canonical: 'Ampol Ltd (formerly Caltex)', industry: 'Fuel & Energy', gst: true, category: 'Fuel & Auto' },
  'ampol': { canonical: 'Ampol Ltd', industry: 'Fuel & Energy', gst: true, category: 'Fuel & Auto' },
};

/** Square POS prefix patterns */
const SQUARE_PATTERN = /^SQ \*/i;
/** Stripe prefix */
const STRIPE_PATTERN = /^STRIPE/i;
/** PayPal prefix */
const PAYPAL_PATTERN = /^PAYPAL \*/i;

export class MerchantIntelligenceAgent extends ClaudeAgent<
  MerchantIntelligenceInput,
  MerchantIntelligenceOutput
> {
  protected systemPrompt = `You are an Australian merchant intelligence specialist. Your job is to resolve abbreviated bank statement merchant descriptions into canonical business names, determine their GST registration status, and infer appropriate transaction categories.

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

  protected tools: Anthropic.Tool[] = [
    {
      name: 'search_cognee_merchant',
      description: 'Search Cognee knowledge graph for previously learned merchant mappings.',
      input_schema: {
        type: 'object' as const,
        properties: {
          merchantName: {
            type: 'string',
            description: 'The abbreviated merchant name from the bank statement',
          },
        },
        required: ['merchantName'],
      },
    },
    {
      name: 'resolve_merchant_name',
      description: 'Resolve an abbreviated merchant name to its canonical business name using known patterns and heuristics.',
      input_schema: {
        type: 'object' as const,
        properties: {
          abbreviatedName: { type: 'string' },
          amount: { type: 'number', description: 'Transaction amount in cents (helps infer merchant type)' },
        },
        required: ['abbreviatedName'],
      },
    },
    {
      name: 'lookup_abn',
      description: 'Look up a business on the Australian Business Register to check ABN and GST registration.',
      input_schema: {
        type: 'object' as const,
        properties: {
          businessName: { type: 'string', description: 'Business name to search for' },
        },
        required: ['businessName'],
      },
    },
    {
      name: 'infer_category',
      description: 'Infer the transaction category based on merchant name, industry, and amount.',
      input_schema: {
        type: 'object' as const,
        properties: {
          merchantName: { type: 'string' },
          industry: { type: 'string' },
          amount: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['merchantName'],
      },
    },
    {
      name: 'store_merchant_mapping',
      description: 'Store a new merchant mapping in Cognee for future reference.',
      input_schema: {
        type: 'object' as const,
        properties: {
          abbreviatedName: { type: 'string' },
          canonicalName: { type: 'string' },
          abn: { type: 'string' },
          gstRegistered: { type: 'boolean' },
          industry: { type: 'string' },
          defaultCategory: { type: 'string' },
        },
        required: ['abbreviatedName', 'canonicalName', 'gstRegistered', 'defaultCategory'],
      },
    },
    {
      name: 'batch_resolve',
      description: 'Batch resolve multiple merchants at once using pattern matching.',
      input_schema: {
        type: 'object' as const,
        properties: {
          merchants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                description: { type: 'string' },
                amount: { type: 'number' },
              },
            },
          },
        },
        required: ['merchants'],
      },
    },
  ];

  protected toolHandlers = new Map<
    string,
    (input: Record<string, unknown>) => Promise<unknown>
  >([
    [
      'search_cognee_merchant',
      async (input) => {
        const name = input.merchantName as string;
        const results = await cogneeTools.search(
          `merchant mapping for "${name}"`,
          'merchant_mappings',
          'CHUNKS_LEXICAL'
        );
        return { found: results.length > 0, results };
      },
    ],
    [
      'resolve_merchant_name',
      async (input) => {
        const abbreviated = (input.abbreviatedName as string).trim();
        const lowerDesc = abbreviated.toLowerCase();

        // Check known merchants
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

        // Strip payment processor prefixes
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

        // Check existing mappings from input
        return {
          resolved: false,
          cleanedName: cleanName,
          hint: 'Unknown merchant — use lookup_abn or infer from context',
          source: 'unknown',
        };
      },
    ],
    [
      'lookup_abn',
      async (input) => {
        const businessName = input.businessName as string;
        // ABR API simulation — in production, call https://abr.business.gov.au/json/
        // For now, use heuristics based on known patterns
        const lowerName = businessName.toLowerCase();

        // Most established Australian businesses are GST registered
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
    ],
    [
      'infer_category',
      async (input) => {
        const name = (input.merchantName as string || '').toLowerCase();
        const industry = (input.industry as string || '').toLowerCase();
        const amount = input.amount as number || 0;

        // Category inference rules
        if (industry.includes('fuel') || name.includes('petrol') || name.includes('fuel') || name.includes('bp ') || name.includes('shell') || name.includes('caltex') || name.includes('ampol')) {
          return { category: 'Fuel & Auto', confidence: 0.9 };
        }
        if (industry.includes('grocery') || name.includes('woolworths') || name.includes('coles') || name.includes('aldi') || name.includes('iga')) {
          return { category: 'Groceries & Supermarkets', confidence: 0.9 };
        }
        if (industry.includes('telecom') || name.includes('telstra') || name.includes('optus') || name.includes('vodafone')) {
          return { category: 'Phone & Internet', confidence: 0.9 };
        }
        if (industry.includes('food') || name.includes('cafe') || name.includes('restaurant') || name.includes('pizza') || name.includes('sushi')) {
          return { category: 'Dining & Restaurants', confidence: 0.8 };
        }
        if (name.includes('uber eats') || name.includes('doordash') || name.includes('menulog')) {
          return { category: 'Food Delivery', confidence: 0.9 };
        }
        if (name.includes('uber') || name.includes('didi') || name.includes('ola')) {
          return { category: 'Transport & Rideshare', confidence: 0.85 };
        }
        if (industry.includes('insurance') || name.includes('insurance') || name.includes('nrma') || name.includes('allianz')) {
          return { category: 'Insurance', confidence: 0.85 };
        }
        if (Math.abs(amount) > 500000) { // > $5000
          return { category: 'Large Purchase', confidence: 0.5 };
        }

        return { category: 'General Expenses', confidence: 0.3 };
      },
    ],
    [
      'store_merchant_mapping',
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
    ],
    [
      'batch_resolve',
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
            gstRegistered: true, // Default assumption for Australian businesses
            defaultCategory: 'General Expenses',
            confidence: 0.3,
            source: 'unknown',
          };
        });
      },
    ],
  ]);

  constructor() {
    super('merchant_intelligence');
  }
}
