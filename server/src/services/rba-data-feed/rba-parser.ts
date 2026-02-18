/**
 * RBA Data Feed — Pure CSV parsing helpers
 */

import { MONTH_MAP } from './constants.js';

export function findHeaderRow(lines: string[]): number {
  for (let i = 5; i < Math.min(lines.length, 20); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.startsWith('series id') || lower.startsWith('title') || lower.startsWith('date'))
      return i;
  }
  return lines.length > 11 ? 10 : -1;
}

export function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function findColumnIndex(headers: string[], targetColumn: string): number {
  const target = targetColumn.toLowerCase().trim();
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    if (header === target || header.includes(target)) return i;
  }
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    if (header.length > 5 && target.includes(header)) return i;
  }
  return -1;
}

export function parseRbaDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[0], 10);
  const monthIdx = MONTH_MAP[parts[1]];
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || monthIdx === undefined || isNaN(year)) return dateStr;
  const d = new Date(year, monthIdx, day);
  return d.toISOString().slice(0, 10);
}

export function inferFrequency(tableKey: string): string {
  switch (tableKey) {
    case 'A2':
      return 'daily';
    case 'F5':
    case 'F11':
      return 'monthly';
    case 'G1':
    case 'H1':
      return 'quarterly';
    default:
      return 'monthly';
  }
}
