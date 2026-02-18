/**
 * Market Cognee Indexer — RBA & ABS Statistical Indexers
 *
 * Converts RBA (Reserve Bank of Australia) and ABS (Australian Bureau of
 * Statistics) indicator data into text documents for Cognee indexing.
 */

import { cogneeTools, COGNEE_DATASETS } from '../claude/cognee-tools.js';
import type { EconomicIndicator } from '../../db/market-schema.js';

// --------------------------------------------------------------------------
// RBA Data
// --------------------------------------------------------------------------

export async function indexRbaData(
  indicators: EconomicIndicator[],
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    if (!indicators?.length) return { count: 0, errors: [] };

    const texts: string[] = [];

    const grouped = new Map<string, EconomicIndicator[]>();
    for (const ind of indicators) {
      const cat = ind.category ?? 'General';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(ind);
    }

    for (const [category, items] of grouped) {
      const indicatorDetails = items
        .map(
          (i) =>
            `${i.indicatorName} (${i.indicatorCode}): ${i.value} ${i.unit}` +
            (i.changePct != null
              ? ` (${Number(i.changePct) >= 0 ? '+' : ''}${Number(i.changePct).toFixed(2)}%)`
              : '') +
            ` [${i.referencePeriod}]`,
        )
        .join('; ');

      const latestDate = items.reduce(
        (max, i) => (i.observationDate > max ? i.observationDate : max),
        items[0].observationDate,
      );

      const text =
        `RBA Statistics — ${category} (as of ${latestDate}). ` +
        `Source: Reserve Bank of Australia. ` +
        `Indicators: ${indicatorDetails}.`;

      texts.push(text.trim());
    }

    for (const ind of indicators) {
      const text =
        `RBA Indicator: ${ind.indicatorName} (${ind.indicatorCode}). ` +
        `Category: ${ind.category}. ` +
        `Value: ${ind.value} ${ind.unit}. ` +
        (ind.previousValue != null ? `Previous: ${ind.previousValue} ${ind.unit}. ` : '') +
        (ind.changePct != null
          ? `Change: ${Number(ind.changePct) >= 0 ? '+' : ''}${Number(ind.changePct).toFixed(2)}%. `
          : '') +
        `Period: ${ind.referencePeriod}. ` +
        `Frequency: ${ind.frequency}. ` +
        `Date: ${ind.observationDate}.`;

      texts.push(text.trim());
    }

    if (texts.length > 0) {
      await cogneeTools.index(texts, COGNEE_DATASETS.rbaStatistics);
    }

    return { count: texts.length, errors };
  } catch (err: unknown) {
    errors.push(`RBA indexing failed: ${err instanceof Error ? err.message : String(err)}`);
    return { count: 0, errors };
  }
}

// --------------------------------------------------------------------------
// ABS Data
// --------------------------------------------------------------------------

export async function indexAbsData(
  indicators: EconomicIndicator[],
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    if (!indicators?.length) return { count: 0, errors: [] };

    const texts: string[] = [];

    const grouped = new Map<string, EconomicIndicator[]>();
    for (const ind of indicators) {
      const cat = ind.category ?? 'General';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(ind);
    }

    for (const [category, items] of grouped) {
      const indicatorDetails = items
        .map(
          (i) =>
            `${i.indicatorName} (${i.indicatorCode}): ${i.value} ${i.unit}` +
            (i.changePct != null
              ? ` (${Number(i.changePct) >= 0 ? '+' : ''}${Number(i.changePct).toFixed(2)}%)`
              : '') +
            ` [${i.referencePeriod}]`,
        )
        .join('; ');

      const latestDate = items.reduce(
        (max, i) => (i.observationDate > max ? i.observationDate : max),
        items[0].observationDate,
      );

      const text =
        `ABS Statistics — ${category} (as of ${latestDate}). ` +
        `Source: Australian Bureau of Statistics. ` +
        `Indicators: ${indicatorDetails}.`;

      texts.push(text.trim());
    }

    for (const ind of indicators) {
      const text =
        `ABS Indicator: ${ind.indicatorName} (${ind.indicatorCode}). ` +
        `Category: ${ind.category}. ` +
        `Value: ${ind.value} ${ind.unit}. ` +
        (ind.previousValue != null ? `Previous: ${ind.previousValue} ${ind.unit}. ` : '') +
        (ind.changePct != null
          ? `Change: ${Number(ind.changePct) >= 0 ? '+' : ''}${Number(ind.changePct).toFixed(2)}%. `
          : '') +
        `Period: ${ind.referencePeriod}. ` +
        `Frequency: ${ind.frequency}. ` +
        `Date: ${ind.observationDate}.`;

      texts.push(text.trim());
    }

    if (texts.length > 0) {
      await cogneeTools.index(texts, COGNEE_DATASETS.absStatistics);
    }

    return { count: texts.length, errors };
  } catch (err: unknown) {
    errors.push(`ABS indexing failed: ${err instanceof Error ? err.message : String(err)}`);
    return { count: 0, errors };
  }
}
