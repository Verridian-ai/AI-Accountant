import type { CategoryType } from './types.js';

export const SUPER_RATE = 0.115; // 11.5% SG rate for 2025-26

export const TYPE_STYLES: Record<CategoryType, { bg: string; text: string }> = {
  ordinary: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  overtime: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  allowance: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  deduction: { bg: 'bg-red-500/10', text: 'text-red-400' },
  super: { bg: 'bg-[#FFCC00]/10', text: 'text-[#FFCC00]' },
  leave: { bg: 'bg-teal-500/10', text: 'text-teal-400' },
};
