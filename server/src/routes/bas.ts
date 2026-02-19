import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, taxCodes } from '../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { BASService, type BASResult } from '../services/bas.js';
import { events } from '../events.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const saveBASSchema = z.record(z.unknown());

const updateBASStatusSchema = z.object({
  status: z.enum(['draft', 'lodged', 'amended']),
});

const basRoutes = new Hono();
const basService = new BASService();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
basRoutes.use('/*', tenantAuthMiddleware());

// Helper: resolve period string to quarter dates
function resolvePeriod(period: string): { financialYear: string; quarter: number } {
  if (period === 'current') {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const fy =
      month >= 7
        ? `${year}-${(year + 1).toString().slice(2)}`
        : `${year - 1}-${year.toString().slice(2)}`;
    let q: number;
    if (month >= 7 && month <= 9) q = 1;
    else if (month >= 10 && month <= 12) q = 2;
    else if (month >= 1 && month <= 3) q = 3;
    else q = 4;
    return { financialYear: fy, quarter: q };
  }
  const [year, q] = period.split('-Q');
  const quarterNum = parseInt(q, 10);
  const fyStartYear = parseInt(year, 10);
  const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
  return { financialYear, quarter: quarterNum };
}

// Get available BAS quarters
basRoutes.get('/quarters', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    return c.json(await basService.getAvailableQuarters(payload.userId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get BAS quarters';
    return c.json({ error: message, code: 'GET_QUARTERS_FAILED' }, 500);
  }
});

// Get BAS calculation
basRoutes.get('/:quarter/calculate', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const quarter = c.req.param('quarter');
    const method = c.req.query('method') || 'accrual';
    const { financialYear, quarter: quarterNum } = resolvePeriod(quarter);
    const result = await basService.calculateBAS(payload.userId, financialYear, quarterNum, method);
    const g5 = result.labels.G2 + result.labels.G3;
    const g6 = result.labels.G1 - g5;
    const g9 = result.labels['1A'];
    const g12 = result.labels.G10 + result.labels.G11;
    const g19 = result.labels['1B'];
    const netPayable = result.totalPayable;
    return c.json({
      periodId: `${financialYear}-Q${quarterNum}`,
      g1_total_sales: result.labels.G1,
      g2_export_sales: result.labels.G2,
      g3_gst_free_sales: result.labels.G3,
      g4_input_taxed_sales: 0,
      g5_g2_to_g4: g5,
      g6_total_taxable_sales: g6,
      g7_adjustments: 0,
      g8_total_sales_subject_gst: g6,
      g9_gst_on_sales: g9,
      g10_capital_purchases: result.labels.G10,
      g11_non_capital_purchases: result.labels.G11,
      g12_g10_plus_g11: g12,
      g13_purchases_no_gst_credit: 0,
      g14_estimated_purchases: 0,
      g15_total_purchases: g12,
      g16_g12_minus_g15: g12,
      g17_adjustments: 0,
      g18_total_purchases_credit: g12,
      g19_gst_credits: g19,
      g20_net_gst: g9 - g19,
      w1_gross_wages: result.labels.W1,
      w2_amounts_withheld: result.labels.W2,
      payg_instalment_5a: result.labels['5A'],
      fuel_tax_credits_7c: result.labels['7C'],
      wine_equalisation_7d: result.labels['7D'],
      net_amount_payable: netPayable > 0 ? netPayable : 0,
      net_refund: netPayable < 0 ? Math.abs(netPayable) : 0,
      _raw: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to calculate BAS';
    return c.json({ error: message, code: 'CALCULATE_BAS_FAILED' }, 500);
  }
});

// Save BAS calculation
basRoutes.post('/:quarter/save', zValidator('json', saveBASSchema), async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const quarter = c.req.param('quarter');
    const body = c.req.valid('json');
    const { financialYear, quarter: quarterNum } = resolvePeriod(quarter);
    const result = await basService.saveBASCalculation(
      payload.userId,
      financialYear,
      quarterNum,
      body as unknown as BASResult,
    );
    events.emit('update', { type: 'bas_updated' });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save BAS';
    return c.json({ error: message, code: 'SAVE_BAS_FAILED' }, 500);
  }
});

// Get BAS history — merges available quarters (from transaction dates) with saved periods
basRoutes.get('/history', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const [availableQuarters, savedPeriods] = await Promise.all([
      basService.getAvailableQuarters(userId),
      basService.getUserPeriods(userId),
    ]);
    const history = availableQuarters.map(({ financialYear, quarter }) => {
      const saved = savedPeriods.find(
        (p) => p.financialYear === financialYear && p.quarter === quarter,
      );
      return {
        financialYear,
        quarter,
        periodId: `${financialYear}-Q${quarter}`,
        status: saved?.status ?? 'not_saved',
        lodgementDue: saved?.lodgementDue ?? null,
        savedAt: saved?.updatedAt ?? null,
        hasSavedData: !!saved,
      };
    });
    return c.json(history);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get BAS history';
    return c.json({ error: message, code: 'GET_HISTORY_FAILED' }, 500);
  }
});

// Get tax codes
basRoutes.get('/tax-codes', async (c) => {
  try {
    return c.json(await db.select().from(taxCodes).all());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get tax codes';
    return c.json({ error: message, code: 'GET_TAX_CODES_FAILED' }, 500);
  }
});

// BAS Calculate (enhanced)
basRoutes.get('/calculate', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const quarter = c.req.query('quarter') || 'current';
    const method = c.req.query('method') || 'full';
    const { financialYear, quarter: quarterNum } = resolvePeriod(quarter);
    const result = await basService.calculateBAS(
      userId,
      financialYear,
      quarterNum,
      method === 'cash' ? 'cash' : 'accrual',
    );
    const { getQuarterDates } = await import('../services/bas.js');
    const dates = getQuarterDates(financialYear, quarterNum);
    const saved = await basService.getSavedBASCalculation(userId, financialYear, quarterNum);
    const status = saved?.period?.status || 'draft';
    return c.json({
      quarter: { year: parseInt(financialYear.split('-')[0], 10), quarter: quarterNum },
      method: method === 'simpler' ? 'simpler' : 'full',
      labels: result.labels,
      netGST: result.netGst,
      totalPayable: result.totalPayable,
      status,
      dueDate: dates.lodgementDue,
      transactionCounts: { total: result.transactionCount },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to calculate BAS';
    return c.json({ error: message, code: 'CALCULATE_ENHANCED_BAS_FAILED' }, 500);
  }
});

// BAS Status Update
basRoutes.patch('/:quarter/status', zValidator('json', updateBASStatusSchema), async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const quarter = c.req.param('quarter');
    const { status } = c.req.valid('json');
    const { financialYear, quarter: quarterNum } = resolvePeriod(quarter);
    const period = await basService.getOrCreatePeriod(userId, financialYear, quarterNum);
    await basService.updatePeriodStatus(
      period.id,
      status,
      status === 'lodged' ? new Date().toISOString() : undefined,
    );
    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update BAS status';
    return c.json({ error: message, code: 'UPDATE_STATUS_FAILED' }, 500);
  }
});

// BAS Comparison
basRoutes.get('/compare', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const q1 = c.req.query('q1') || '';
    const q2 = c.req.query('q2') || '';
    if (!q1 || !q2)
      return c.json({ error: 'Both q1 and q2 are required', code: 'MISSING_PARAMS' }, 400);
    const period1 = resolvePeriod(q1);
    const period2 = resolvePeriod(q2);
    const [result1, result2] = await Promise.all([
      basService.calculateBAS(payload.userId, period1.financialYear, period1.quarter),
      basService.calculateBAS(payload.userId, period2.financialYear, period2.quarter),
    ]);
    return c.json({ periodA: result1, periodB: result2 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to compare BAS periods';
    return c.json({ error: message, code: 'COMPARE_BAS_FAILED' }, 500);
  }
});

// BAS Drill-Down
basRoutes.get('/:quarter/drill-down/:label', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const quarter = c.req.param('quarter');
    const label = c.req.param('label');
    const { financialYear, quarter: quarterNum } = resolvePeriod(quarter);
    const { getQuarterDates } = await import('../services/bas.js');
    const dates = getQuarterDates(financialYear, quarterNum);
    const txns = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, payload.userId),
          gte(transactions.date, dates.startDate),
          lte(transactions.date, dates.endDate),
          eq(transactions.isTransfer, false),
        ),
      )
      .all();
    type TxRow = typeof transactions.$inferSelect;
    const filtered = txns.filter((tx: TxRow) => {
      const cat = tx.gstCategory || 'taxable_10';
      switch (label) {
        case 'G1':
          return tx.amount > 0 && cat === 'taxable_10';
        case 'G2':
          return tx.amount > 0 && cat === 'export';
        case 'G3':
          return tx.amount > 0 && cat === 'gst_free';
        case 'G10':
          return tx.amount < 0 && cat === 'capital';
        case 'G11':
          return tx.amount < 0 && cat === 'taxable_10';
        case '1A':
          return tx.amount > 0 && cat === 'taxable_10';
        case '1B':
          return tx.amount < 0 && (cat === 'taxable_10' || cat === 'capital');
        default:
          return false;
      }
    });
    return c.json(
      filtered.map((tx: Record<string, unknown>) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        gstCategory: tx.gstCategory,
        gstAmount: tx.gstAmount,
        category: tx.category,
      })),
    );
  } catch {
    return c.json([]);
  }
});

export default basRoutes;
