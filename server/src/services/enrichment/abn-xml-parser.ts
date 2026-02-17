/**
 * ABN Lookup — XML Response Parsers
 *
 * Parses ABR XML responses using regex extraction
 * (no xml2js dependency needed).
 */

import { normalizeABN } from '../../utils/abn.js';
import { logger } from '../../utils/logger.js';
import type { ABNLookupResult } from './abn-types.js';

/**
 * Extract the text content of a simple XML tag.
 * Handles both <tag>value</tag> and self-closing <tag/>.
 * Ignores XML namespace prefixes (e.g., <abr:tagName> matches <tagName>).
 */
export function extractTag(xml: string, tagName: string): string {
  // Match with optional namespace prefix: <ns:tagName>value</ns:tagName>
  const regex = new RegExp(`<(?:\\w+:)?${tagName}[^>]*>([^<]*)</(?:\\w+:)?${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Parse GST registration status from ABR XML.
 * ABR uses <goodsAndServicesTax> blocks with <effectiveFrom> and <effectiveTo> dates.
 * A block with effectiveTo = '0001-01-01' (or empty/future date) means GST is currently active.
 */
export function parseGSTStatus(xml: string): {
  gstRegistered: boolean;
  gstRegistrationDate?: string;
} {
  // Match all goodsAndServicesTax blocks
  const gstBlockRegex = /<goodsAndServicesTax>([\s\S]*?)<\/goodsAndServicesTax>/gi;
  const blocks = xml.match(gstBlockRegex);

  if (!blocks || blocks.length === 0) {
    return { gstRegistered: false };
  }

  const now = new Date();

  for (const block of blocks) {
    const effectiveFrom = extractTag(block, 'effectiveFrom') || '';
    const effectiveTo = extractTag(block, 'effectiveTo') || '';

    // effectiveTo of '0001-01-01' means the GST registration is still active (no end date)
    const isOpenEnded = effectiveTo === '0001-01-01' || effectiveTo === '';

    if (isOpenEnded) {
      return { gstRegistered: true, gstRegistrationDate: effectiveFrom || undefined };
    }

    // Check if effectiveTo is a future date
    const endDate = new Date(effectiveTo);
    if (!isNaN(endDate.getTime()) && endDate > now) {
      return { gstRegistered: true, gstRegistrationDate: effectiveFrom || undefined };
    }
  }

  // All GST blocks have expired end dates
  return { gstRegistered: false };
}

/**
 * Parse XML response from SearchByABNv202001.
 */
export function parseABNResponse(xml: string): ABNLookupResult | null {
  try {
    // Check for exception/error in response
    if (xml.includes('<exception>') || xml.includes('<exceptionDescription>')) {
      const errMsg = extractTag(xml, 'exceptionDescription');
      logger.warn(`[ABN] API error: ${errMsg}`);
      return null;
    }

    const abn = extractTag(xml, 'identifierValue') || '';
    if (!abn) return null;

    const entityStatusCode = extractTag(xml, 'entityStatusCode') || '';
    const isCurrentIndicator = extractTag(xml, 'isCurrentIndicator') || '';
    const isCurrentABN = isCurrentIndicator.toUpperCase() === 'Y';

    const organisationName = extractTag(xml, 'organisationName') || '';
    const mainTradingName = extractTag(xml, 'mainTradingName') || '';
    const fullName = extractTag(xml, 'fullName') || '';
    const individualName = [extractTag(xml, 'givenName'), extractTag(xml, 'familyName')]
      .filter(Boolean)
      .join(' ');

    const businessName = organisationName || mainTradingName || fullName || individualName || '';
    const tradingName =
      mainTradingName && mainTradingName !== businessName ? mainTradingName : undefined;

    const entityType = extractTag(xml, 'entityDescription') || '';
    const { gstRegistered, gstRegistrationDate } = parseGSTStatus(xml);

    const state = extractTag(xml, 'stateCode') || undefined;
    const postcode = extractTag(xml, 'postcode') || undefined;

    return {
      abn: normalizeABN(abn) || abn,
      abnStatus: entityStatusCode === 'Active' ? 'Active' : 'Cancelled',
      isCurrentABN,
      businessName,
      tradingName,
      entityType,
      gstRegistered,
      gstRegistrationDate,
      state,
      postcode,
    };
  } catch (err) {
    logger.error({ err }, '[ABN] Failed to parse ABN response');
    return null;
  }
}

/**
 * Parse XML response from ABRSearchByNameAdvanced2017.
 */
export function parseNameSearchResponse(xml: string): ABNLookupResult[] {
  try {
    if (xml.includes('<exception>') || xml.includes('<exceptionDescription>')) {
      const errMsg = extractTag(xml, 'exceptionDescription');
      logger.warn(`[ABN] Name search API error: ${errMsg}`);
      return [];
    }

    const results: ABNLookupResult[] = [];
    const records = xml.split(/<searchResultsRecord>/i).slice(1);

    for (const record of records) {
      const abn = extractTag(record, 'identifierValue') || '';
      if (!abn) continue;

      const abnStatus = extractTag(record, 'identifierStatus') || '';
      const mainTradingName = extractTag(record, 'mainTradingName') || '';
      const businessName =
        extractTag(record, 'organisationName') ||
        mainTradingName ||
        extractTag(record, 'mainName') ||
        '';

      const state = extractTag(record, 'stateCode') || undefined;
      const postcode = extractTag(record, 'postcode') || undefined;

      results.push({
        abn: normalizeABN(abn) || abn,
        abnStatus: abnStatus === 'Active' ? 'Active' : 'Cancelled',
        isCurrentABN: true,
        businessName,
        tradingName:
          mainTradingName && mainTradingName !== businessName ? mainTradingName : undefined,
        entityType: '',
        gstRegistered: false,
        state,
        postcode,
      });
    }

    return results;
  } catch (err) {
    logger.error({ err }, '[ABN] Failed to parse name search response');
    return [];
  }
}
