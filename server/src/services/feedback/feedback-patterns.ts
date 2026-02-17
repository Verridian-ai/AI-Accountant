/**
 * Feedback Patterns — Pattern analysis and parser improvement suggestions.
 *
 * Standalone functions that are augmented onto FeedbackManager prototype
 * from feedback-analysis.ts.
 */

import { db, parserFeedback } from '../../schema.js';
import { and, gte, lt } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import type { FeedbackType, FeedbackPattern, ParserImprovementSuggestion } from './types.js';

/** Analyze feedback patterns to identify parser issues. */
export async function analyzeFeedbackPatterns(options?: {
  startDate?: string;
  endDate?: string;
  minOccurrences?: number;
}): Promise<FeedbackPattern[]> {
  logger.info('[FeedbackManager] Analyzing feedback patterns');

  const conditions: any[] = [];
  if (options?.startDate) conditions.push(gte(parserFeedback.createdAt, options.startDate));
  if (options?.endDate) conditions.push(lt(parserFeedback.createdAt, options.endDate));

  const allFeedback = await db
    .select()
    .from(parserFeedback)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();

  const patternMap = new Map<
    string,
    {
      feedbackType: FeedbackType;
      originalValue: string;
      correctedValue: string;
      userIds: Set<string>;
      confidences: number[];
      bankIds: Set<string>;
    }
  >();

  for (const fb of allFeedback) {
    const key = `${fb.feedbackType}::${fb.originalValue}::${fb.correctedValue}`;
    if (!patternMap.has(key)) {
      patternMap.set(key, {
        feedbackType: fb.feedbackType as FeedbackType,
        originalValue: fb.originalValue || '',
        correctedValue: fb.correctedValue || '',
        userIds: new Set(),
        confidences: [],
        bankIds: new Set(),
      });
    }
    const pattern = patternMap.get(key)!;
    pattern.userIds.add(fb.userId);
    if (fb.aiConfidence !== null) pattern.confidences.push(fb.aiConfidence);
    if (fb.bankId) pattern.bankIds.add(fb.bankId);
  }

  const minOccurrences = options?.minOccurrences || 1;
  return Array.from(patternMap.values())
    .filter((p) => p.userIds.size >= minOccurrences)
    .map((p) => ({
      feedbackType: p.feedbackType,
      originalValue: p.originalValue,
      correctedValue: p.correctedValue,
      occurrences: p.userIds.size,
      uniqueUsers: p.userIds.size,
      avgConfidence:
        p.confidences.length > 0
          ? p.confidences.reduce((a, b) => a + b, 0) / p.confidences.length
          : null,
      bankIds: Array.from(p.bankIds),
    }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

export function calculatePriority(pattern: FeedbackPattern): 'high' | 'medium' | 'low' {
  if (
    pattern.occurrences >= 10 ||
    (pattern.avgConfidence !== null && pattern.avgConfidence < 0.5)
  ) {
    return 'high';
  }
  if (pattern.occurrences >= 5) return 'medium';
  return 'low';
}

/** Generate parser improvement suggestions based on feedback patterns. */
export async function generateParserImprovementSuggestions(): Promise<
  ParserImprovementSuggestion[]
> {
  logger.info('[FeedbackManager] Generating parser improvement suggestions');
  const patterns = await analyzeFeedbackPatterns({ minOccurrences: 3 });
  const suggestions: ParserImprovementSuggestion[] = [];

  for (const pattern of patterns) {
    const priority = calculatePriority(pattern);
    switch (pattern.feedbackType) {
      case 'category_correction':
        suggestions.push({
          type: 'category_rule',
          priority,
          description: `Users frequently change "${pattern.originalValue}" to "${pattern.correctedValue}"`,
          pattern: pattern.originalValue,
          suggestedFix: `Add rule: When category is "${pattern.originalValue}", consider "${pattern.correctedValue}" instead`,
          affectedCount: pattern.occurrences,
          confidence: pattern.avgConfidence || 0.5,
        });
        break;
      case 'description_correction':
        suggestions.push({
          type: 'merchant_mapping',
          priority,
          description: `Merchant name "${pattern.originalValue}" should be "${pattern.correctedValue}"`,
          pattern: pattern.originalValue,
          suggestedFix: `Add merchant mapping: "${pattern.originalValue}" -> "${pattern.correctedValue}"`,
          affectedCount: pattern.occurrences,
          confidence: 0.9,
        });
        break;
      case 'date_correction':
        suggestions.push({
          type: 'date_format',
          priority,
          description: `Date parsing error: "${pattern.originalValue}" should be "${pattern.correctedValue}"`,
          pattern: pattern.originalValue,
          suggestedFix: `Review date format parsing for banks: ${pattern.bankIds.join(', ')}`,
          affectedCount: pattern.occurrences,
          confidence: 0.8,
        });
        break;
      case 'amount_correction':
        suggestions.push({
          type: 'amount_parsing',
          priority,
          description: `Amount parsing error: ${pattern.originalValue} cents should be ${pattern.correctedValue} cents`,
          pattern: pattern.originalValue,
          suggestedFix: `Check decimal/currency parsing logic`,
          affectedCount: pattern.occurrences,
          confidence: 0.9,
        });
        break;
      case 'duplicate_flag':
        suggestions.push({
          type: 'duplicate_detection',
          priority,
          description: `Duplicate transactions not detected`,
          pattern: 'duplicate_detection',
          suggestedFix: `Improve duplicate detection algorithm`,
          affectedCount: pattern.occurrences,
          confidence: 0.7,
        });
        break;
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return suggestions;
}
