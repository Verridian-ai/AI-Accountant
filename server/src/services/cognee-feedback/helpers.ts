/**
 * Cognee Feedback — Shared helper functions.
 */

/**
 * Calculate trend by comparing accuracy of the recent half vs older half.
 * Feedback should be sorted newest-first.
 */
export function calculateTrend(
  feedbackItems: any[],
  midpoint: number,
): 'improving' | 'declining' | 'stable' {
  if (feedbackItems.length < 4) return 'stable';

  const recentHalf = feedbackItems.slice(0, midpoint);
  const olderHalf = feedbackItems.slice(midpoint);

  const recentAccuracy = halfAccuracy(recentHalf);
  const olderAccuracy = halfAccuracy(olderHalf);

  const diff = recentAccuracy - olderAccuracy;
  if (diff > 0.05) return 'improving';
  if (diff < -0.05) return 'declining';
  return 'stable';
}

function halfAccuracy(items: any[]): number {
  if (items.length === 0) return 0;
  let score = 0;
  for (const fb of items) {
    if (fb.feedbackType === 'correct') score += 1;
    else if (fb.feedbackType === 'partial') score += 0.5;
  }
  return score / items.length;
}
