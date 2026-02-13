/**
 * ABN Lookup Adapter — ABR (Australian Business Register) Official API
 *
 * Queries the ABR XML Search API to:
 * - Validate ABNs and retrieve business details
 * - Search businesses by name
 * - Determine GST registration status
 *
 * Results are cached in the merchantMemory table to avoid repeat lookups.
 *
 * @see https://abr.business.gov.au/Documentation/WebServiceResponse
 */

import { validateABN, normalizeABN } from '../../utils/abn.js';
import { db, merchantMemory } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

const ABR_BASE_URL = 'https://abr.business.gov.au/abrxmlsearch/abrxmlsearch.asmx';

export interface ABNLookupResult {
  abn: string;
  abnStatus: 'Active' | 'Cancelled';
  isCurrentABN: boolean;
  businessName: string;
  tradingName?: string;
  entityType: string;
  gstRegistered: boolean;
  gstRegistrationDate?: string;
  state?: string;
  postcode?: string;
}

export class ABNLookupService {
  private guid: string;

  constructor() {
    this.guid = process.env.ABNLOOKUP_GUID || '';
    if (!this.guid) {
      logger.warn('[ABN] No ABNLOOKUP_GUID set — ABN lookups will be unavailable');
    }
  }

  /** Whether the service is configured and available */
  get available(): boolean {
    return this.guid.length > 0;
  }

  /**
   * Search for a business by ABN.
   * Validates the ABN checksum before calling the API.
   * Returns cached result from merchantMemory if available.
   */
  async searchByABN(abn: string): Promise<ABNLookupResult | null> {
    if (!this.available) return null;

    const normalized = normalizeABN(abn);
    if (!normalized) return null;

    const validation = validateABN(normalized);
    if (!validation.isValid) {
      logger.warn(`[ABN] Invalid ABN checksum: ${abn}`);
      return null;
    }

    // Check cache first
    const cached = await this.getCachedABN(normalized);
    if (cached) return cached;

    const url = `${ABR_BASE_URL}/SearchByABNv202001?searchString=${encodeURIComponent(normalized)}&includeHistoricalDetails=N&authenticationGuid=${encodeURIComponent(this.guid)}`;

    const xml = await this.fetchWithRetry(url);
    if (!xml) return null;

    const result = this.parseABNResponse(xml);
    return result;
  }

  /**
   * Search for businesses by name.
   * Returns up to 5 matches with a minimum relevance score of 80.
   */
  async searchByName(name: string): Promise<ABNLookupResult[]> {
    if (!this.available) return [];
    if (!name || name.trim().length < 3) return [];

    const params = new URLSearchParams({
      name: name.trim(),
      postcode: '',
      legalName: 'Y',
      tradingName: 'Y',
      businessName: 'Y',
      activeABNsOnly: 'Y',
      NSW: 'Y',
      SA: 'Y',
      ACT: 'Y',
      VIC: 'Y',
      WA: 'Y',
      NT: 'Y',
      QLD: 'Y',
      TAS: 'Y',
      authenticationGuid: this.guid,
      searchWidth: 'Typical',
      minimumScore: '80',
      maxSearchResults: '5',
    });

    const url = `${ABR_BASE_URL}/ABRSearchByNameAdvanced2017?${params.toString()}`;

    const xml = await this.fetchWithRetry(url);
    if (!xml) return [];

    return this.parseNameSearchResponse(xml);
  }

  /**
   * Check merchantMemory for a cached ABN lookup result.
   */
  private async getCachedABN(abn: string): Promise<ABNLookupResult | null> {
    try {
      const records = await db
        .select()
        .from(merchantMemory)
        .where(eq(merchantMemory.merchantPattern, `abn:${abn}`))
        .all();

      if (records.length > 0) {
        const rec: any = records[0];
        logger.debug(`[ABN] Cache hit for ABN ${abn}`);
        return {
          abn,
          abnStatus: 'Active',
          isCurrentABN: true,
          businessName: rec.merchantDisplayName || '',
          entityType: '',
          gstRegistered: rec.gstApplicable ?? false,
        };
      }
    } catch (err) {
      logger.warn('[ABN] Cache lookup failed:', err);
    }
    return null;
  }

  /**
   * Store ABN lookup result in merchantMemory for future cache hits.
   */
  async cacheResult(userId: string, result: ABNLookupResult): Promise<void> {
    try {
      const cacheKey = `abn:${result.abn}`;
      const existing = await db
        .select()
        .from(merchantMemory)
        .where(and(eq(merchantMemory.userId, userId), eq(merchantMemory.merchantPattern, cacheKey)))
        .get();

      if (existing) {
        await db
          .update(merchantMemory)
          .set({
            merchantDisplayName: result.businessName,
            gstApplicable: result.gstRegistered,
            lastUsed: new Date().toISOString(),
          })
          .where(eq(merchantMemory.id, existing.id));
      } else {
        const crypto = await import('crypto');
        await db.insert(merchantMemory).values({
          id: crypto.randomUUID(),
          userId,
          merchantPattern: cacheKey,
          merchantDisplayName: result.businessName,
          category: 'Uncategorized',
          gstApplicable: result.gstRegistered,
          timesUsed: 1,
          lastUsed: new Date().toISOString(),
          isUserConfirmed: false,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.warn('[ABN] Failed to cache ABN result:', err);
    }
  }

  /**
   * HTTP GET with exponential backoff retry (3 attempts: 1s, 2s, 4s).
   */
  private async fetchWithRetry(url: string, retries = 3): Promise<string | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/xml' },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (err: any) {
        logger.warn(`[ABN] Request attempt ${attempt}/${retries} failed: ${err.message}`);
        if (attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    logger.error('[ABN] All retry attempts exhausted');
    return null;
  }

  /**
   * Parse XML response from SearchByABNv202001.
   * Uses regex extraction instead of xml2js to avoid extra dependency.
   *
   * ABR XML structure:
   *  - ABN: <identifierValue>, status via <entityStatusCode>, currency via <isCurrentIndicator>
   *  - GST: <goodsAndServicesTax> blocks with <effectiveFrom>/<effectiveTo> dates
   *    (effectiveTo = 0001-01-01 means still active)
   *  - Names: <organisationName>, <mainTradingName>, <givenName>/<familyName>
   */
  private parseABNResponse(xml: string): ABNLookupResult | null {
    try {
      // Check for exception/error in response
      if (xml.includes('<exception>') || xml.includes('<exceptionDescription>')) {
        const errMsg = this.extractTag(xml, 'exceptionDescription');
        logger.warn(`[ABN] API error: ${errMsg}`);
        return null;
      }

      const abn = this.extractTag(xml, 'identifierValue') || '';
      if (!abn) return null;

      // ABN status: use entityStatusCode inside entityStatus block
      const entityStatusCode = this.extractTag(xml, 'entityStatusCode') || '';

      // ABN currency: isCurrentIndicator on the ABN element
      const isCurrentIndicator = this.extractTag(xml, 'isCurrentIndicator') || '';
      const isCurrentABN = isCurrentIndicator.toUpperCase() === 'Y';

      // Business name — try multiple fields including mainTradingName
      const organisationName = this.extractTag(xml, 'organisationName') || '';
      const mainTradingName = this.extractTag(xml, 'mainTradingName') || '';
      const fullName = this.extractTag(xml, 'fullName') || '';
      const individualName = [this.extractTag(xml, 'givenName'), this.extractTag(xml, 'familyName')]
        .filter(Boolean)
        .join(' ');

      const businessName = organisationName || mainTradingName || fullName || individualName || '';
      const tradingName =
        mainTradingName && mainTradingName !== businessName ? mainTradingName : undefined;

      // Entity type
      const entityType = this.extractTag(xml, 'entityDescription') || '';

      // GST registration: parse <goodsAndServicesTax> blocks
      // GST is active if there's a block where effectiveTo is '0001-01-01' or a future date
      const { gstRegistered, gstRegistrationDate } = this.parseGSTStatus(xml);

      // Location
      const state = this.extractTag(xml, 'stateCode') || undefined;
      const postcode = this.extractTag(xml, 'postcode') || undefined;

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
      logger.error('[ABN] Failed to parse ABN response', err);
      return null;
    }
  }

  /**
   * Parse GST registration status from ABR XML.
   * ABR uses <goodsAndServicesTax> blocks with <effectiveFrom> and <effectiveTo> dates.
   * A block with effectiveTo = '0001-01-01' (or empty/future date) means GST is currently active.
   */
  private parseGSTStatus(xml: string): { gstRegistered: boolean; gstRegistrationDate?: string } {
    // Match all goodsAndServicesTax blocks
    const gstBlockRegex = /<goodsAndServicesTax>([\s\S]*?)<\/goodsAndServicesTax>/gi;
    const blocks = xml.match(gstBlockRegex);

    if (!blocks || blocks.length === 0) {
      return { gstRegistered: false };
    }

    const now = new Date();

    for (const block of blocks) {
      const effectiveFrom = this.extractTag(block, 'effectiveFrom') || '';
      const effectiveTo = this.extractTag(block, 'effectiveTo') || '';

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
   * Parse XML response from ABRSearchByNameAdvanced2017.
   * Name search returns <searchResultsRecord> blocks with:
   *  - <ABN><identifierValue> and <ABN><identifierStatus>
   *  - <mainName>/<mainTradingName> for business names
   */
  private parseNameSearchResponse(xml: string): ABNLookupResult[] {
    try {
      if (xml.includes('<exception>') || xml.includes('<exceptionDescription>')) {
        const errMsg = this.extractTag(xml, 'exceptionDescription');
        logger.warn(`[ABN] Name search API error: ${errMsg}`);
        return [];
      }

      const results: ABNLookupResult[] = [];

      // Split on searchResultsRecord blocks
      const records = xml.split(/<searchResultsRecord>/i).slice(1);

      for (const record of records) {
        // ABN value is inside <ABN><identifierValue>
        const abn = this.extractTag(record, 'identifierValue') || '';
        if (!abn) continue;

        // Status is <identifierStatus> within the <ABN> block for name search results
        const abnStatus = this.extractTag(record, 'identifierStatus') || '';

        // Name: try mainName, mainTradingName, organisationName
        const mainTradingName = this.extractTag(record, 'mainTradingName') || '';
        const businessName =
          this.extractTag(record, 'organisationName') ||
          mainTradingName ||
          this.extractTag(record, 'mainName') ||
          '';

        const state = this.extractTag(record, 'stateCode') || undefined;
        const postcode = this.extractTag(record, 'postcode') || undefined;

        results.push({
          abn: normalizeABN(abn) || abn,
          abnStatus: abnStatus === 'Active' ? 'Active' : 'Cancelled',
          isCurrentABN: true, // Name search only returns active ABNs (activeABNsOnly=Y)
          businessName,
          tradingName:
            mainTradingName && mainTradingName !== businessName ? mainTradingName : undefined,
          entityType: '',
          gstRegistered: false, // Name search doesn't include GST details
          state,
          postcode,
        });
      }

      return results;
    } catch (err) {
      logger.error('[ABN] Failed to parse name search response', err);
      return [];
    }
  }

  /**
   * Test the ABR API connection using a known ABN (Woolworths Group: 88000014675).
   * Validates that the GUID works and the XML response parses correctly.
   */
  async testConnection(): Promise<{ ok: boolean; error?: string; result?: ABNLookupResult }> {
    if (!this.available) {
      return { ok: false, error: 'No ABNLOOKUP_GUID configured' };
    }

    const testABN = '88000014675'; // Woolworths Group Limited
    const url = `${ABR_BASE_URL}/SearchByABNv202001?searchString=${testABN}&includeHistoricalDetails=N&authenticationGuid=${encodeURIComponent(this.guid)}`;

    try {
      const xml = await this.fetchWithRetry(url, 1);
      if (!xml) {
        return { ok: false, error: 'No response from ABR API' };
      }

      if (xml.includes('<exceptionDescription>')) {
        const errMsg = this.extractTag(xml, 'exceptionDescription');
        return { ok: false, error: `ABR API error: ${errMsg}` };
      }

      const result = this.parseABNResponse(xml);
      if (!result) {
        return { ok: false, error: 'Failed to parse ABR response XML' };
      }

      if (!result.abn || result.abn !== testABN) {
        return { ok: false, error: `Unexpected ABN in response: ${result.abn}` };
      }

      logger.info(
        `[ABN] Connection test passed: ${result.businessName} (GST: ${result.gstRegistered})`,
      );
      return { ok: true, result };
    } catch (err: any) {
      return { ok: false, error: `Connection test failed: ${err.message}` };
    }
  }

  /**
   * Extract the text content of a simple XML tag.
   * Handles both <tag>value</tag> and self-closing <tag/>.
   * Ignores XML namespace prefixes (e.g., <abr:tagName> matches <tagName>).
   */
  private extractTag(xml: string, tagName: string): string {
    // Match with optional namespace prefix: <ns:tagName>value</ns:tagName>
    const regex = new RegExp(`<(?:\\w+:)?${tagName}[^>]*>([^<]*)</(?:\\w+:)?${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }
}
