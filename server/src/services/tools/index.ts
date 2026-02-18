/**
 * Tools barrel export.
 * Server-side tools that Claude agents can invoke during conversations.
 */
export {
  getExactTotalsTool,
  executeGetExactTotals,
  type GetExactTotalsInput,
  type AggregateResult,
} from './aggregate-tool.js';
