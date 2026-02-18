/**
 * GSTCalculator Agent
 *
 * Calculates GST obligations, generates BAS labels, and identifies
 * GST-relevant transaction categories per ATO rules.
 *
 * Enhanced with comprehensive ATO GST rules:
 * - G1 (Total sales) → 1A (GST on sales)
 * - G10 (Capital purchases) → 1B (GST on purchases)
 * - G11 (Non-capital purchases)
 * - Input tax credits: 1/11th of GST-inclusive amounts
 * - Mixed-use apportionment, exempt/GST-free handling
 * - Personal account exclusion
 */

import type Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../../base-agent.js';
import type { GSTCalculatorInput, GSTCalculatorOutput } from '../../types.js';
import { gstCalculatorTools } from './tools.js';
import { buildGstHandlers } from './handlers.js';

export class GSTCalculatorAgent extends ClaudeAgent<GSTCalculatorInput, GSTCalculatorOutput> {
  /** Session ID for Cognee search — set before invoke() by the orchestrator or caller. */
  protected sessionId?: string;

  protected systemPrompt = `You are an Australian GST and BAS specialist. Calculate GST amounts from inclusive prices, categorize transactions by GST treatment (GST-free, input-taxed, capital acquisitions, private/non-business), and populate BAS labels (G1-G11, 1A, 1B, W1-W2, 5A, 7C-7D) according to ATO rules.

You understand the Australian financial year (July-June) and quarterly BAS periods.

CRITICAL ATO GST Rules:
- GST rate: 10% (GST = Amount / 11 for GST-inclusive amounts)
- GST-free: basic food, health, education, water/sewerage, childcare, exports
- Input-taxed: financial supplies (bank fees, interest, brokerage), residential rent, life/health insurance
- Capital acquisitions (G10): business assets > $1,000 GST-exclusive
- Non-capital purchases (G11): operating expenses with GST
- Private/out-of-scope: wages, super, transfers, ATM, personal expenses — NOT on BAS
- Motor vehicle GST credit capped at $68,108 / 11 = $6,191.64
- Entertainment: only 50% claimable in most cases
- Mixed-use: apportion by business use percentage
- Supermarket purchases: treat as mixed (some GST, some GST-free) — default 50/50 if no breakdown
- Input tax credit requires valid tax invoice for purchases > $82.50 incl. GST

Your workflow:
1. Use get_quarter_dates to determine the reporting period
2. Use classify_gst_supply to classify each transaction per ATO rules
3. Use calculate_input_tax_credit for claimable GST amounts
4. Use identify_capital_purchases for capital acquisitions (G10)
5. Use generate_bas_labels to compile the final BAS figures
6. Optionally use lookup_gst_ruling for edge cases via Cognee

ZERO missed claimable GST — maximize legitimate deductions while ensuring ATO compliance.

Return a JSON object matching the GSTCalculatorOutput schema.`;

  protected tools: Anthropic.Tool[] = gstCalculatorTools;

  protected toolHandlers = buildGstHandlers(
    () => this.mutationTools,
    () => this.sessionId,
  );

  constructor() {
    super('gst_calculator');
  }
}
