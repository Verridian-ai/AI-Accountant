/**
 * Export Service — Format Generators (CSV, text reports)
 */

import type { ExportType } from './types.js';

/**
 * Escape CSV value
 */
export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generate CSV content
 */
export function generateCSV(data: unknown): string {
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) {
      const flattened: Record<string, unknown>[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          flattened.push({ __section__: key.toUpperCase() });
          flattened.push(...value);
        }
      }
      if (flattened.length > 0) {
        return generateCSV(flattened);
      }
    }
    return '';
  }

  if (data.length === 0) {
    return '';
  }

  const allKeys = new Set<string>();
  for (const item of data) {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach((key) => allKeys.add(key));
    }
  }

  const headers = Array.from(allKeys);
  const rows: string[] = [];

  rows.push(headers.map((h) => escapeCSV(h)).join(','));

  for (const item of data) {
    if (typeof item === 'object' && item !== null) {
      const row = headers.map((h) => {
        const value = (item as Record<string, unknown>)[h];
        return escapeCSV(value);
      });
      rows.push(row.join(','));
    }
  }

  return rows.join('\n');
}

/**
 * Generate text report
 */
export function generateTextReport(data: unknown, type: ExportType): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push(`GoldLedger - ${type.toUpperCase()} Export`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');

  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        for (const [key, value] of Object.entries(item)) {
          lines.push(`${key}: ${value}`);
        }
        lines.push('-'.repeat(40));
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    for (const [section, items] of Object.entries(data)) {
      lines.push(`\n## ${section.toUpperCase()}`);
      lines.push('-'.repeat(40));
      if (Array.isArray(items)) {
        for (const item of items) {
          if (typeof item === 'object' && item !== null) {
            for (const [key, value] of Object.entries(item)) {
              lines.push(`  ${key}: ${value}`);
            }
            lines.push('');
          }
        }
      }
    }
  }

  return lines.join('\n');
}
