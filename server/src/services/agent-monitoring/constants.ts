/**
 * Agent Monitoring — Token Cost Constants
 */

// Token costs in USD per 1K tokens
export const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250514': { input: 0.003, output: 0.015 },
  'claude-sonnet-4-5-20250929': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5-20250514': { input: 0.001, output: 0.005 },
  'claude-haiku-4-5-20251001': { input: 0.001, output: 0.005 },
  'claude-opus-4-6': { input: 0.015, output: 0.075 },
  'google/gemini-3-flash-preview': { input: 0.0001, output: 0.0004 },
  default: { input: 0.003, output: 0.015 },
};
