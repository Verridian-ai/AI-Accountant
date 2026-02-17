/**
 * Citation Formatting
 *
 * Formats citations for UI display and provides helper methods
 * for building source titles, deep links, and relevance labels.
 */

import type { CitationWithSource, FormattedCitation } from './types.js';

// ============================================================================
// CITATION FORMATTING
// ============================================================================

/**
 * Format citations for UI display
 */
export function formatCitationsForDisplay(citations: CitationWithSource[]): FormattedCitation[] {
  return citations.map((citation) => {
    const sourceType = mapSourceType(citation.sourceType);
    const relevanceLabel = getRelevanceLabel(citation.relevanceScore || 0);

    // Build source display info
    const sourceInfo: FormattedCitation['source'] = {
      type: sourceType,
      title: buildSourceTitle(citation),
    };

    // Add optional fields based on available data
    if (citation.transactionDetails) {
      sourceInfo.date = citation.transactionDetails.date;
      sourceInfo.amount = formatCurrency(citation.transactionDetails.amount);
      sourceInfo.category = citation.transactionDetails.category || undefined;
    }

    if (citation.accountDetails) {
      sourceInfo.account = `${citation.accountDetails.accountName} (${citation.accountDetails.accountNumber})`;
    }

    // Check if source is verifiable
    const verifiable = !!(citation.transactionId || citation.accountId);

    // Build deep link for navigation
    const deepLink = buildDeepLink(citation);

    return {
      id: citation.id,
      position: citation.position + 1, // 1-indexed for display
      snippet: citation.snippet,
      source: sourceInfo,
      relevance: {
        score: citation.relevanceScore || 0,
        label: relevanceLabel,
      },
      verifiable,
      deepLink,
    };
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map source type string to typed value
 */
export function mapSourceType(
  sourceType: string,
): 'transaction' | 'account' | 'statement' | 'manual' {
  const validTypes = ['transaction', 'account', 'statement', 'manual'];
  return validTypes.includes(sourceType)
    ? (sourceType as 'transaction' | 'account' | 'statement' | 'manual')
    : 'manual';
}

/**
 * Get relevance label based on score
 */
export function getRelevanceLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Build a display title for the source
 */
export function buildSourceTitle(citation: CitationWithSource): string {
  if (citation.transactionDetails) {
    return `Transaction: ${citation.transactionDetails.description}`;
  }

  if (citation.accountDetails) {
    return `Account: ${citation.accountDetails.accountName}`;
  }

  if (citation.sourceTitle) {
    return citation.sourceTitle;
  }

  return `${capitalizeFirst(citation.sourceType)} Source`;
}

/**
 * Format currency amount (cents to dollars)
 */
export function formatCurrency(amountInCents: number): string {
  const dollars = Math.abs(amountInCents) / 100;
  const sign = amountInCents < 0 ? '-' : '';
  return `${sign}$${dollars.toFixed(2)}`;
}

/**
 * Build a deep link URL for navigation
 */
export function buildDeepLink(citation: CitationWithSource): string | undefined {
  if (citation.transactionId) {
    return `/transactions/${citation.transactionId}`;
  }

  if (citation.accountId) {
    return `/accounts/${citation.accountId}`;
  }

  return undefined;
}

/**
 * Capitalize first letter of string
 */
export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
