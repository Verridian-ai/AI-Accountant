/**
 * Token Map Builder (v4 Pipeline)
 *
 * Merges two token sources into a single map for the StreamingUnredactor:
 *
 * 1. **Pseudonym map** — deterministic name pseudonyms from the Neon AI branch
 *    e.g. "Vendor_7f2a Pty Ltd" → "Smith & Jones Pty Ltd"
 *
 * 2. **Amount tags** — per-session [[amt:uuid]] tags from the AmountTagger
 *    e.g. "[[amt:abc123]]" → "$45,000.00"
 *
 * The builder is a pure computation with no external dependencies (no Redis,
 * no DB). The caller can optionally cache the result.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenMap {
  /** Deterministic pseudonym → real name mappings. */
  pseudonyms: Map<string, string>;
  /** [[amt:uuid]] → formatted currency mappings. */
  amounts: Map<string, string>;
  /** Union of pseudonyms + amounts — the map fed to StreamingUnredactor. */
  all: Map<string, string>;
}

// ---------------------------------------------------------------------------
// PII name columns that may contain pseudonymized values
// ---------------------------------------------------------------------------

const PII_NAME_COLUMNS = [
  'description',
  'first_name',
  'last_name',
  'business_name',
  'contact_name',
  'email',
  'merchant_normalized',
  'supplier_name',
  'customer_name',
  'employee_name',
  'company_name',
  'payee_name',
] as const;

// ---------------------------------------------------------------------------
// TokenMapBuilder
// ---------------------------------------------------------------------------

export class TokenMapBuilder {
  /**
   * Build a complete token map for a chat session by diffing masked data
   * against real data and merging with amount tags.
   *
   * @param params.maskedData  Rows from the Neon AI branch (deterministic pseudonyms)
   * @param params.realData    Same rows from Neon production (real values)
   * @param params.amountTokenMap  Map from AmountTagger.tagObjects()
   */
  buildTokenMap(params: {
    maskedData: Record<string, unknown>[];
    realData: Record<string, unknown>[];
    amountTokenMap: Map<string, string>;
  }): TokenMap {
    const { maskedData, realData, amountTokenMap } = params;

    const pseudonyms = this.extractPseudonymMap(maskedData, realData);

    // Merge into a single map — amounts take precedence if there's a collision
    // (unlikely since pseudonyms are names and amounts are [[amt:...]] tags)
    const all = new Map<string, string>();
    for (const [masked, real] of pseudonyms) {
      all.set(masked, real);
    }
    for (const [tag, real] of amountTokenMap) {
      all.set(tag, real);
    }

    return { pseudonyms, amounts: amountTokenMap, all };
  }

  // -------------------------------------------------------------------------
  // Extract pseudonym → real name mappings by diffing masked vs real rows
  // -------------------------------------------------------------------------

  private extractPseudonymMap(
    masked: Record<string, unknown>[],
    real: Record<string, unknown>[],
  ): Map<string, string> {
    const map = new Map<string, string>();

    const rowCount = Math.min(masked.length, real.length);
    for (let i = 0; i < rowCount; i++) {
      const maskedRow = masked[i];
      const realRow = real[i];

      for (const col of PII_NAME_COLUMNS) {
        const maskedVal = maskedRow[col];
        const realVal = realRow[col];

        if (
          maskedVal != null &&
          realVal != null &&
          typeof maskedVal === 'string' &&
          typeof realVal === 'string' &&
          maskedVal.length > 0 &&
          realVal.length > 0 &&
          maskedVal !== realVal
        ) {
          // Deterministic masking: same input always produces the same
          // pseudonym, so duplicates are harmless (same key → same value).
          map.set(maskedVal, realVal);
        }
      }
    }

    return map;
  }
}
