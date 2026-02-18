import type { CategoryType, RateType } from './types';

export const TYPE_ORDER: CategoryType[] = [
  'ordinary',
  'overtime',
  'allowance',
  'deduction',
  'super',
  'leave',
];

export const TYPE_STYLES: Record<CategoryType, { bg: string; text: string; label: string }> = {
  ordinary: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Ordinary' },
  overtime: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Overtime' },
  allowance: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Allowance' },
  deduction: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Deduction' },
  super: { bg: 'bg-[#FFCC00]/10', text: 'text-[#FFCC00]', label: 'Super' },
  leave: { bg: 'bg-teal-500/10', text: 'text-teal-400', label: 'Leave' },
};

export const RATE_SUFFIXES: Record<RateType, string> = {
  hourly: '/hr',
  annual: '/year',
  fixed: '',
};
