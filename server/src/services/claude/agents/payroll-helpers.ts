/**
 * Payroll Agent helpers — constants, patterns, and utility functions.
 *
 * Extracted from payroll-agent.ts to comply with the 300-line enterprise standard.
 */

/**
 * Determine the current Australian financial year string.
 * AU FY runs July 1 -> June 30. e.g. Feb 2026 -> "2025-26".
 */
export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  if (month >= 7) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

/** Known wage payment description patterns */
export const WAGE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\bSALARY\b/i, type: 'salary' },
  { pattern: /\bWAGES?\b/i, type: 'wages' },
  { pattern: /\bPAYROLL\b/i, type: 'payroll' },
  { pattern: /\bADP\b/i, type: 'payroll_provider' },
  { pattern: /\bMYOB\s*PAYROLL\b/i, type: 'payroll_provider' },
  { pattern: /\bXERO\s*PAYROLL\b/i, type: 'payroll_provider' },
  { pattern: /\bKEYPAY\b/i, type: 'payroll_provider' },
  { pattern: /\bEMPLOYMENT\s*HERO\b/i, type: 'payroll_provider' },
  { pattern: /\bPAY\s*RUN\b/i, type: 'payroll' },
  { pattern: /\bSTAFF\s*PAY\b/i, type: 'wages' },
  { pattern: /\bSUPER(?:ANNUATION)?\s*(?:GUARANTEE|CONTRIB)/i, type: 'super' },
];

/** Known employee name patterns for Amica Beauty */
export const KNOWN_EMPLOYEES: Record<string, { fullName: string; tfnDeclared: boolean }> = {
  'bree perry': { fullName: 'Bree Perry', tfnDeclared: true },
  christina: { fullName: 'Christina', tfnDeclared: true },
  josevski: { fullName: 'Josevski', tfnDeclared: true },
};

/**
 * Detect if a transaction description matches a wage payment pattern.
 */
export function detectWagePattern(description: string): {
  isWage: boolean;
  type: string;
  confidence: number;
} {
  const desc = description.toLowerCase();
  for (const { pattern, type } of WAGE_PATTERNS) {
    if (pattern.test(desc)) {
      return { isWage: true, type, confidence: 0.9 };
    }
  }
  // Check for known employee names
  for (const name of Object.keys(KNOWN_EMPLOYEES)) {
    if (desc.includes(name)) {
      return { isWage: true, type: 'employee_name', confidence: 0.85 };
    }
  }
  return { isWage: false, type: 'none', confidence: 0 };
}

/**
 * Extract employee name from transaction description.
 */
export function extractEmployeeName(description: string): string | undefined {
  const desc = description.toLowerCase();
  for (const [key, info] of Object.entries(KNOWN_EMPLOYEES)) {
    if (desc.includes(key)) return info.fullName;
  }
  // Try to extract name after common prefixes
  const nameMatch = description.match(/(?:WAGES?|SALARY|PAYROLL)\s*[-:]\s*(.+?)(?:\s*[-/]|$)/i);
  if (nameMatch) return nameMatch[1].trim();
  return undefined;
}
