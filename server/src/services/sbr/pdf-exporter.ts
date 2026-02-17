/**
 * SBR PDF/Text Report Exporter
 *
 * Generates a text-based BAS report for record keeping.
 * (Placeholder for PDF — currently generates a formatted text report.)
 */

import type { BASData, BusinessProfile } from './types.js';
import { formatABN, formatCurrencyReport } from './helpers.js';

/**
 * Generate text report (placeholder for PDF)
 */
export function generatePDFReport(basData: BASData, profile: BusinessProfile): string {
  const lines: string[] = [];
  const divider = '='.repeat(70);
  const subDivider = '-'.repeat(70);

  lines.push(divider);
  lines.push('                    BUSINESS ACTIVITY STATEMENT');
  lines.push(divider);
  lines.push('');
  lines.push('BUSINESS DETAILS');
  lines.push(subDivider);
  lines.push(`ABN:                ${formatABN(profile.abn)}`);
  lines.push(`Business Name:      ${profile.businessName}`);
  if (profile.tradingName) {
    lines.push(`Trading Name:       ${profile.tradingName}`);
  }
  lines.push('');
  lines.push('PERIOD DETAILS');
  lines.push(subDivider);
  lines.push(`Financial Year:     ${basData.financialYear}`);
  lines.push(`Quarter:            Q${basData.quarter}`);
  lines.push(`Period:             ${basData.periodStart} to ${basData.periodEnd}`);
  lines.push('');

  lines.push('GST - GOODS AND SERVICES TAX');
  lines.push(subDivider);
  lines.push('');
  lines.push('Sales');
  lines.push(
    `  G1  Total sales (including GST)       ${formatCurrencyReport(basData.gstLabels.G1)}`,
  );
  lines.push(
    `  G2  Export sales                      ${formatCurrencyReport(basData.gstLabels.G2)}`,
  );
  lines.push(
    `  G3  Other GST-free sales              ${formatCurrencyReport(basData.gstLabels.G3)}`,
  );
  lines.push('');
  lines.push('Purchases');
  lines.push(
    `  G10 Capital purchases                 ${formatCurrencyReport(basData.gstLabels.G10)}`,
  );
  lines.push(
    `  G11 Non-capital purchases             ${formatCurrencyReport(basData.gstLabels.G11)}`,
  );
  lines.push('');
  lines.push('GST Summary');
  lines.push(
    `  1A  GST on sales                      ${formatCurrencyReport(basData.gstSummary['1A'])}`,
  );
  lines.push(
    `  1B  GST on purchases                  ${formatCurrencyReport(basData.gstSummary['1B'])}`,
  );
  const netGst = (basData.gstSummary['1A'] || 0) - (basData.gstSummary['1B'] || 0);
  lines.push(`      Net GST                           ${formatCurrencyReport(netGst)}`);
  lines.push('');

  lines.push('PAYG WITHHOLDING');
  lines.push(subDivider);
  lines.push(
    `  W1  Total salary, wages and payments  ${formatCurrencyReport(basData.paygWithholding.W1)}`,
  );
  lines.push(
    `  W2  Amounts withheld                  ${formatCurrencyReport(basData.paygWithholding.W2)}`,
  );
  lines.push('');

  if (basData.paygInstalment['5A']) {
    lines.push('PAYG INSTALMENT');
    lines.push(subDivider);
    lines.push(
      `  5A  PAYG instalment                   ${formatCurrencyReport(basData.paygInstalment['5A'])}`,
    );
    lines.push('');
  }

  if (basData.fuelTaxCredits?.['7C'] || basData.fuelTaxCredits?.['7D']) {
    lines.push('FUEL TAX CREDITS');
    lines.push(subDivider);
    lines.push(
      `  7C  Business use                      ${formatCurrencyReport(basData.fuelTaxCredits['7C'])}`,
    );
    lines.push(
      `  7D  Other activities                  ${formatCurrencyReport(basData.fuelTaxCredits['7D'])}`,
    );
    lines.push('');
  }

  const totalPaygWithholding = basData.paygWithholding.W4 || basData.paygWithholding.W2;
  const totalFuelTaxCredits =
    (basData.fuelTaxCredits?.['7C'] || 0) + (basData.fuelTaxCredits?.['7D'] || 0);
  const paygInstalment = basData.paygInstalment['5A'] || 0;
  const totalPayable = netGst + totalPaygWithholding + paygInstalment - totalFuelTaxCredits;

  lines.push(divider);
  lines.push('SUMMARY');
  lines.push(divider);
  lines.push('');
  lines.push(`  Net GST                               ${formatCurrencyReport(netGst)}`);
  lines.push(
    `  PAYG Withholding                      ${formatCurrencyReport(totalPaygWithholding)}`,
  );
  lines.push(`  PAYG Instalment                       ${formatCurrencyReport(paygInstalment)}`);
  lines.push(
    `  Fuel Tax Credits                      ${formatCurrencyReport(-totalFuelTaxCredits)}`,
  );
  lines.push(subDivider);
  lines.push(
    `  TOTAL ${totalPayable >= 0 ? 'PAYABLE' : 'REFUND'}                    ${formatCurrencyReport(Math.abs(totalPayable))}`,
  );
  lines.push('');
  lines.push(divider);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`This is a summary report for record keeping purposes.`);
  lines.push(`For official lodgement, use the XML export via SBR channels.`);
  lines.push(divider);

  return lines.join('\n');
}
