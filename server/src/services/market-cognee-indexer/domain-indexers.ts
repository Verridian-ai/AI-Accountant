/**
 * Market Cognee Indexer — Domain-Specific Indexing Functions
 *
 * Market intelligence, sentiment, and price indexers plus snapshot builder.
 * RBA/ABS statistical indexers are in statistical-indexers.ts.
 */

import { cogneeTools, COGNEE_DATASETS } from '../claude/cognee-tools.js';

// Re-export RBA/ABS from their own file for convenience
export { indexRbaData, indexAbsData } from './statistical-indexers.js';

// --------------------------------------------------------------------------
// Market Intelligence
// --------------------------------------------------------------------------

export async function indexMarketIntelligence(
  snapshots: Array<{
    topic: string;
    summary: string;
    sentimentLabel: string;
    observationDate: string;
    indicators?: Array<{ name: string; value: number; unit: string; changePct: number | null }>;
    prices?: Array<{ symbol: string; name: string; price: number; changePct: number | null }>;
  }>,
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    if (!snapshots?.length) return { count: 0, errors: [] };

    const texts: string[] = [];

    for (const snap of snapshots) {
      let text =
        `Market Intelligence: ${snap.topic} (${snap.observationDate}). ` +
        `Sentiment: ${snap.sentimentLabel}. ` +
        (snap.summary ? `Summary: ${snap.summary}. ` : '');

      if (snap.indicators?.length) {
        const indicatorText = snap.indicators
          .map(
            (i) =>
              `${i.name}: ${i.value} ${i.unit}` +
              (i.changePct != null
                ? ` (${i.changePct >= 0 ? '+' : ''}${i.changePct.toFixed(2)}%)`
                : ''),
          )
          .join('; ');
        text += `Key Indicators: ${indicatorText}. `;
      }

      if (snap.prices?.length) {
        const priceText = snap.prices
          .map(
            (p) =>
              `${p.symbol} (${p.name}): $${p.price.toFixed(2)}` +
              (p.changePct != null
                ? ` (${p.changePct >= 0 ? '+' : ''}${p.changePct.toFixed(2)}%)`
                : ''),
          )
          .join('; ');
        text += `Market Prices: ${priceText}. `;
      }

      texts.push(text.trim());
    }

    if (texts.length > 0) {
      await cogneeTools.index(texts, COGNEE_DATASETS.marketIntelligence);
    }

    return { count: texts.length, errors };
  } catch (err: any) {
    errors.push(`Market intelligence indexing failed: ${err.message}`);
    return { count: 0, errors };
  }
}

// --------------------------------------------------------------------------
// Sentiment Data
// --------------------------------------------------------------------------

export async function indexSentimentData(
  sentiments: any[],
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    if (!sentiments?.length) return { count: 0, errors: [] };

    const texts: string[] = [];

    for (const s of sentiments) {
      const text =
        `Sentiment Analysis: "${s.topic}" (${s.observationDate}). ` +
        `Query: "${s.query}". ` +
        (s.sentimentLabel ? `Label: ${s.sentimentLabel}. ` : '') +
        (s.sentimentScore != null ? `Score: ${Number(s.sentimentScore).toFixed(2)}. ` : '') +
        (s.confidence != null ? `Confidence: ${(Number(s.confidence) * 100).toFixed(0)}%. ` : '') +
        `Posts: ${s.totalPosts ?? 0} (positive: ${s.positiveCount ?? 0}, negative: ${s.negativeCount ?? 0}, neutral: ${s.neutralCount ?? 0}). ` +
        (s.summary ? `Summary: ${s.summary}. ` : '') +
        (s.analysisModel ? `Model: ${s.analysisModel}. ` : '');

      texts.push(text.trim());
    }

    if (texts.length > 0) {
      await cogneeTools.index(texts, COGNEE_DATASETS.marketSentiment);
    }

    return { count: texts.length, errors };
  } catch (err: any) {
    errors.push(`Sentiment indexing failed: ${err.message}`);
    return { count: 0, errors };
  }
}

// --------------------------------------------------------------------------
// Market Prices
// --------------------------------------------------------------------------

export async function indexMarketPrices(
  prices: any[],
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    if (!prices?.length) return { count: 0, errors: [] };

    const texts: string[] = [];

    for (const p of prices) {
      const text =
        `Market Price: ${p.symbol} — ${p.name}. ` +
        `Type: ${p.assetType}. ` +
        `Price: $${Number(p.price).toFixed(2)} ${p.currency ?? 'AUD'}. ` +
        (p.previousClose != null
          ? `Previous Close: $${Number(p.previousClose).toFixed(2)}. `
          : '') +
        (p.changePct != null
          ? `Change: ${Number(p.changePct) >= 0 ? '+' : ''}${Number(p.changePct).toFixed(2)}%. `
          : '') +
        (p.dayHigh != null && p.dayLow != null
          ? `Range: $${Number(p.dayLow).toFixed(2)} – $${Number(p.dayHigh).toFixed(2)}. `
          : '') +
        (p.volume != null ? `Volume: ${Number(p.volume).toLocaleString()}. ` : '') +
        (p.marketCap != null ? `Market Cap: $${Number(p.marketCap).toLocaleString()}. ` : '') +
        (p.exchange ? `Exchange: ${p.exchange}. ` : '') +
        `Date: ${p.observationDate}.`;

      texts.push(text.trim());
    }

    if (texts.length > 0) {
      await cogneeTools.index(texts, COGNEE_DATASETS.asxMarketData);
    }

    return { count: texts.length, errors };
  } catch (err: any) {
    errors.push(`Market price indexing failed: ${err.message}`);
    return { count: 0, errors };
  }
}

// --------------------------------------------------------------------------
// Build intelligence snapshots (combines data from all domains)
// --------------------------------------------------------------------------

export type IntelligenceSnapshot = {
  topic: string;
  summary: string;
  sentimentLabel: string;
  observationDate: string;
  indicators?: Array<{ name: string; value: number; unit: string; changePct: number | null }>;
  prices?: Array<{ symbol: string; name: string; price: number; changePct: number | null }>;
};

export function buildIntelligenceSnapshots(
  rbaIndicators: any[],
  absIndicators: any[],
  sentiments: any[],
  prices: any[],
): IntelligenceSnapshot[] {
  const snapshots: IntelligenceSnapshot[] = [];
  const today = new Date().toISOString().split('T')[0];

  if (rbaIndicators.length) {
    snapshots.push({
      topic: 'RBA Economic Overview',
      summary: `${rbaIndicators.length} RBA indicators tracked across ${new Set(rbaIndicators.map((i: any) => i.category)).size} categories`,
      sentimentLabel: 'informational',
      observationDate: today,
      indicators: rbaIndicators.slice(0, 10).map((i: any) => ({
        name: i.indicatorName,
        value: Number(i.value),
        unit: i.unit,
        changePct: i.changePct != null ? Number(i.changePct) : null,
      })),
    });
  }

  if (absIndicators.length) {
    snapshots.push({
      topic: 'ABS Economic Overview',
      summary: `${absIndicators.length} ABS indicators tracked across ${new Set(absIndicators.map((i: any) => i.category)).size} categories`,
      sentimentLabel: 'informational',
      observationDate: today,
      indicators: absIndicators.slice(0, 10).map((i: any) => ({
        name: i.indicatorName,
        value: Number(i.value),
        unit: i.unit,
        changePct: i.changePct != null ? Number(i.changePct) : null,
      })),
    });
  }

  if (prices.length) {
    snapshots.push({
      topic: 'Market Prices Overview',
      summary: `${prices.length} assets tracked across ${new Set(prices.map((p: any) => p.assetType)).size} asset types`,
      sentimentLabel: 'informational',
      observationDate: today,
      prices: prices.slice(0, 15).map((p: any) => ({
        symbol: p.symbol,
        name: p.name,
        price: Number(p.price),
        changePct: p.changePct != null ? Number(p.changePct) : null,
      })),
    });
  }

  for (const s of sentiments) {
    snapshots.push({
      topic: s.topic,
      summary: s.summary ?? '',
      sentimentLabel: s.sentimentLabel ?? 'neutral',
      observationDate: s.observationDate ?? today,
    });
  }

  return snapshots;
}
