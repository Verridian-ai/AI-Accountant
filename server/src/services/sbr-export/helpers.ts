import path from 'path';
import fs from 'fs/promises';
import type { BASData } from './types.js';

export function formatABN(abn: string): string {
  const clean = abn.replace(/\s/g, '');
  if (clean.length !== 11) return clean;
  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
}

export function centsToWholeNumber(cents: number): number {
  return Math.round(cents / 100);
}

export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatCurrencyCSV(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatCurrencyReport(cents: number): string {
  const formatted = `$${Math.abs(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sign = cents < 0 ? '-' : ' ';
  return `${sign}${formatted}`.padStart(15);
}

export function escapeXml(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }

  return (
    str
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/\]\]>/g, ']]&gt;')
      .replace(/<\?xml/gi, '&lt;?xml')
      .replace(/<!DOCTYPE/gi, '&lt;!DOCTYPE')
      .replace(/<!ENTITY/gi, '&lt;!ENTITY')
  );
}

export function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export function calculateDerivedValues(basData: BASData): BASData {
  const g = { ...basData.gstLabels };

  if (g.G5 === undefined) {
    g.G5 = (g.G2 || 0) + (g.G3 || 0) + (g.G4 || 0);
  }
  if (g.G6 === undefined && g.G1 !== undefined) {
    g.G6 = g.G1 - g.G5;
  }
  if (g.G8 === undefined && g.G6 !== undefined) {
    g.G8 = g.G6 + (g.G7 || 0);
  }
  if (g.G9 === undefined && g.G8 !== undefined) {
    g.G9 = Math.round(g.G8 / 11);
  }
  if (g.G12 === undefined) {
    g.G12 = (g.G10 || 0) + (g.G11 || 0);
  }
  if (g.G16 === undefined) {
    g.G16 = g.G12 - (g.G13 || 0) - (g.G14 || 0) - (g.G15 || 0);
  }
  if (g.G18 === undefined) {
    g.G18 = g.G16 + (g.G17 || 0);
  }
  if (g.G19 === undefined && g.G18 !== undefined) {
    g.G19 = Math.round(g.G18 / 11);
  }
  if (g.G20 === undefined && g.G9 !== undefined && g.G19 !== undefined) {
    g.G20 = g.G9 - g.G19;
  }

  return { ...basData, gstLabels: g };
}

export async function ensureExportDir(exportDir: string, userId: string): Promise<void> {
  const userDir = path.join(exportDir, userId);
  await fs.mkdir(userDir, { recursive: true });
}
