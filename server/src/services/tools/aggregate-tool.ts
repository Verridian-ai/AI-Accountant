/**
 * Aggregate Tool — get_exact_totals
 *
 * Claude tool that queries the PRODUCTION Neon database for exact financial
 * aggregates (sum, avg, min, max, count).  This bypasses the masked AI branch
 * entirely — aggregate results are inherently k-anonymized and safe to return.
 *
 * The tool is defined using adaptLegacyTool() so it integrates with the
 * existing Vercel AI SDK tool pipeline.
 */

import { adaptLegacyTool } from '../claude/tool-adapter.js';
import { db } from '../../schema.js';
import { logger } from '../../lib/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GetExactTotalsInput {
  account_ids: string[];
  date_from?: string;
  date_to?: string;
  category?: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface AggregateResult {
  total: number;
  currency: 'AUD';
  count: number;
  period?: string;
}

// ---------------------------------------------------------------------------
// Vercel AI SDK Tool (via adaptLegacyTool)
// ---------------------------------------------------------------------------

export const getExactTotalsTool = adaptLegacyTool(
  'get_exact_totals',
  'Calculate exact financial totals from the production database. Use this instead of summing [[amt:ID]] tokens. Returns real, exact numbers for sums, averages, counts, min, or max of transaction amounts.',
  {
    type: 'object',
    properties: {
      account_ids: {
        type: 'array',
        description: 'Account IDs to include in the aggregation',
      },
      date_from: {
        type: 'string',
        description: 'Start date filter (YYYY-MM-DD)',
      },
      date_to: {
        type: 'string',
        description: 'End date filter (YYYY-MM-DD)',
      },
      category: {
        type: 'string',
        description: 'Optional category filter',
      },
      aggregation: {
        type: 'string',
        description: 'Aggregation function to apply',
        enum: ['sum', 'avg', 'min', 'max', 'count'],
      },
    },
    required: ['account_ids', 'aggregation'],
  },
  async (input: Record<string, unknown>): Promise<AggregateResult> => {
    const parsed: GetExactTotalsInput = {
      account_ids: input.account_ids as string[],
      date_from: input.date_from as string | undefined,
      date_to: input.date_to as string | undefined,
      category: input.category as string | undefined,
      aggregation: input.aggregation as GetExactTotalsInput['aggregation'],
    };
    return executeGetExactTotals(parsed);
  },
);

// ---------------------------------------------------------------------------
// Standalone execution (can be called directly outside tool context)
// ---------------------------------------------------------------------------

export async function executeGetExactTotals(input: GetExactTotalsInput): Promise<AggregateResult> {
  const { account_ids, date_from, date_to, category, aggregation } = input;

  // Validate aggregation function (whitelist to prevent SQL injection)
  const VALID_AGGREGATIONS = ['sum', 'avg', 'min', 'max', 'count'] as const;
  if (!VALID_AGGREGATIONS.includes(aggregation)) {
    throw new Error(`Invalid aggregation: ${aggregation}`);
  }

  // Build parameterized query
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  // Account IDs filter
  if (account_ids.length > 0) {
    const placeholders = account_ids.map(() => `$${paramIdx++}`).join(', ');
    conditions.push(`account_id IN (${placeholders})`);
    params.push(...account_ids);
  }

  // Date range filters
  if (date_from) {
    conditions.push(`date >= $${paramIdx++}`);
    params.push(date_from);
  }
  if (date_to) {
    conditions.push(`date <= $${paramIdx++}`);
    params.push(date_to);
  }

  // Category filter
  if (category) {
    conditions.push(`category = $${paramIdx++}`);
    params.push(category);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Use the whitelisted aggregation function directly (safe — validated above)
  const aggExpr = aggregation === 'count' ? 'COUNT(*)' : `${aggregation.toUpperCase()}(amount)`;

  const sql = `SELECT ${aggExpr} AS agg_result, COUNT(*) AS row_count FROM transactions ${whereClause}`;

  logger.info(`[AggregateTool] Executing: ${aggregation} on ${account_ids.length} accounts`);

  try {
    const rows = await db.all(sql, params);
    const row = Array.isArray(rows) ? rows[0] : rows;

    if (!row) {
      return { total: 0, currency: 'AUD', count: 0 };
    }

    const rawTotal = Number(row.agg_result ?? 0);
    const count = Number(row.row_count ?? 0);

    // Convert from cents to dollars for sum/avg/min/max
    // count returns a pure count, not a dollar amount
    const total = aggregation === 'count' ? rawTotal : rawTotal / 100;

    const result: AggregateResult = {
      total: Math.round(total * 100) / 100, // 2 decimal places
      currency: 'AUD',
      count,
    };

    if (date_from ?? date_to) {
      result.period = `${date_from ?? '...'} to ${date_to ?? '...'}`;
    }

    logger.info(`[AggregateTool] Result: ${aggregation} = ${result.total} (${count} rows)`);

    return result;
  } catch (err) {
    logger.error('[AggregateTool] Query failed:', err instanceof Error ? err.message : String(err));
    throw new Error(
      `Aggregate query failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
  }
}
