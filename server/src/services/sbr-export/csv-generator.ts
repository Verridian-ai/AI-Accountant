import type { BASData, BusinessProfile } from './types.js';
import { formatABN, formatCurrencyCSV, escapeCSV } from './helpers.js';

export function generateBASCSV(basData: BASData, profile: BusinessProfile): string {
  const rows: string[][] = [];

  rows.push(['Business Activity Statement Summary']);
  rows.push([]);
  rows.push(['Business Details']);
  rows.push(['ABN', formatABN(profile.abn)]);
  rows.push(['Business Name', profile.businessName]);
  rows.push(['Financial Year', basData.financialYear]);
  rows.push(['Quarter', `Q${basData.quarter}`]);
  rows.push(['Period', `${basData.periodStart} to ${basData.periodEnd}`]);
  rows.push([]);

  rows.push(['GST - Sales']);
  rows.push(['Label', 'Description', 'Amount ($)']);
  rows.push(['G1', 'Total sales (including GST)', formatCurrencyCSV(basData.gstLabels.G1)]);
  rows.push(['G2', 'Export sales', formatCurrencyCSV(basData.gstLabels.G2)]);
  rows.push(['G3', 'Other GST-free sales', formatCurrencyCSV(basData.gstLabels.G3)]);
  if (basData.gstLabels.G4) {
    rows.push(['G4', 'Input taxed sales', formatCurrencyCSV(basData.gstLabels.G4)]);
  }
  rows.push([]);

  rows.push(['GST - Purchases']);
  rows.push(['G10', 'Capital purchases', formatCurrencyCSV(basData.gstLabels.G10)]);
  rows.push(['G11', 'Non-capital purchases', formatCurrencyCSV(basData.gstLabels.G11)]);
  rows.push([]);

  rows.push(['GST Summary']);
  rows.push(['1A', 'GST on sales', formatCurrencyCSV(basData.gstSummary['1A'])]);
  rows.push(['1B', 'GST on purchases', formatCurrencyCSV(basData.gstSummary['1B'])]);
  const netGst = (basData.gstSummary['1A'] || 0) - (basData.gstSummary['1B'] || 0);
  rows.push(['', 'Net GST', formatCurrencyCSV(netGst)]);
  rows.push([]);

  rows.push(['PAYG Withholding']);
  rows.push([
    'W1',
    'Total salary, wages and payments',
    formatCurrencyCSV(basData.paygWithholding.W1),
  ]);
  rows.push(['W2', 'Amounts withheld', formatCurrencyCSV(basData.paygWithholding.W2)]);
  if (basData.paygWithholding.W3) {
    rows.push(['W3', 'Other amounts withheld', formatCurrencyCSV(basData.paygWithholding.W3)]);
  }
  rows.push([]);

  if (basData.paygInstalment['5A']) {
    rows.push(['PAYG Instalment']);
    rows.push(['5A', 'PAYG instalment', formatCurrencyCSV(basData.paygInstalment['5A'])]);
    rows.push([]);
  }

  if (basData.fuelTaxCredits?.['7C'] || basData.fuelTaxCredits?.['7D']) {
    rows.push(['Fuel Tax Credits']);
    rows.push(['7C', 'Business use', formatCurrencyCSV(basData.fuelTaxCredits['7C'])]);
    rows.push(['7D', 'Other activities', formatCurrencyCSV(basData.fuelTaxCredits['7D'])]);
    rows.push([]);
  }

  const totalPaygWithholding = basData.paygWithholding.W4 || basData.paygWithholding.W2;
  const totalFuelTaxCredits =
    (basData.fuelTaxCredits?.['7C'] || 0) + (basData.fuelTaxCredits?.['7D'] || 0);
  const paygInstalment = basData.paygInstalment['5A'] || 0;
  const totalPayable = netGst + totalPaygWithholding + paygInstalment - totalFuelTaxCredits;

  rows.push(['Total']);
  rows.push(['', 'Total amount payable/refundable', formatCurrencyCSV(totalPayable)]);
  rows.push(['', totalPayable >= 0 ? 'AMOUNT PAYABLE' : 'REFUND DUE', '']);

  return rows.map((row) => row.map((cell) => escapeCSV(cell)).join(',')).join('\n');
}
