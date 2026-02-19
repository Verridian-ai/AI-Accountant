/**
 * Semantic three-tier color system for transaction categories
 *
 * Design Principles:
 * 1. Income/Revenue -> Green family (emerald, green, teal)
 * 2. Expenses -> Warm spectrum (orange, amber, rose, pink, purple, blue, etc.)
 * 3. System/Transfer -> Neutral (zinc, slate)
 * 4. Uncategorized -> Amber (NOT red - red conflicts with negative amounts)
 */

import { CATEGORIES, type CategoryDefinition } from './categories';

export interface CategoryColor {
  name: string;
  bg: string;
  text: string;
  border: string;
  gradient: string;
  dot: string;
  badge: {
    bg: string;
    text: string;
    border: string;
    shadow: string;
  };
}

// ============================================================================
// REVENUE COLORS - Green family for income
// ============================================================================
const REVENUE_COLORS: CategoryColor[] = [
  {
    name: 'emerald',
    bg: 'bg-emerald-500',
    text: 'text-emerald-400',
    border: 'border-emerald-500',
    gradient: 'from-emerald-500 to-emerald-400',
    dot: 'bg-emerald-500',
    badge: {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/25',
      shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    },
  },
  {
    name: 'green',
    bg: 'bg-green-500',
    text: 'text-green-400',
    border: 'border-green-500',
    gradient: 'from-green-500 to-green-400',
    dot: 'bg-green-500',
    badge: {
      bg: 'bg-green-500/15',
      text: 'text-green-400',
      border: 'border-green-500/25',
      shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.2)]',
    },
  },
  {
    name: 'teal',
    bg: 'bg-teal-500',
    text: 'text-teal-400',
    border: 'border-teal-500',
    gradient: 'from-teal-500 to-teal-400',
    dot: 'bg-teal-500',
    badge: {
      bg: 'bg-teal-500/15',
      text: 'text-teal-400',
      border: 'border-teal-500/25',
      shadow: 'shadow-[0_0_15px_rgba(20,184,166,0.2)]',
    },
  },
  {
    name: 'lime',
    bg: 'bg-lime-500',
    text: 'text-lime-400',
    border: 'border-lime-500',
    gradient: 'from-lime-500 to-lime-400',
    dot: 'bg-lime-500',
    badge: {
      bg: 'bg-lime-500/15',
      text: 'text-lime-400',
      border: 'border-lime-500/25',
      shadow: 'shadow-[0_0_15px_rgba(132,204,22,0.2)]',
    },
  },
  {
    name: 'cyan',
    bg: 'bg-cyan-500',
    text: 'text-cyan-400',
    border: 'border-cyan-500',
    gradient: 'from-cyan-500 to-cyan-400',
    dot: 'bg-cyan-500',
    badge: {
      bg: 'bg-cyan-500/15',
      text: 'text-cyan-400',
      border: 'border-cyan-500/25',
      shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.2)]',
    },
  },
];

// ============================================================================
// EXPENSE COLORS - Warm spectrum for expenses
// ============================================================================
const EXPENSE_COLORS: CategoryColor[] = [
  {
    name: 'orange',
    bg: 'bg-orange-500',
    text: 'text-orange-400',
    border: 'border-orange-500',
    gradient: 'from-orange-500 to-orange-400',
    dot: 'bg-orange-500',
    badge: {
      bg: 'bg-orange-500/15',
      text: 'text-orange-400',
      border: 'border-orange-500/25',
      shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.2)]',
    },
  },
  {
    name: 'rose',
    bg: 'bg-rose-500',
    text: 'text-rose-400',
    border: 'border-rose-500',
    gradient: 'from-rose-500 to-rose-400',
    dot: 'bg-rose-500',
    badge: {
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      border: 'border-rose-500/25',
      shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.2)]',
    },
  },
  {
    name: 'pink',
    bg: 'bg-pink-500',
    text: 'text-pink-400',
    border: 'border-pink-500',
    gradient: 'from-pink-500 to-pink-400',
    dot: 'bg-pink-500',
    badge: {
      bg: 'bg-pink-500/15',
      text: 'text-pink-400',
      border: 'border-pink-500/25',
      shadow: 'shadow-[0_0_15px_rgba(236,72,153,0.2)]',
    },
  },
  {
    name: 'fuchsia',
    bg: 'bg-fuchsia-500',
    text: 'text-fuchsia-400',
    border: 'border-fuchsia-500',
    gradient: 'from-fuchsia-500 to-fuchsia-400',
    dot: 'bg-fuchsia-500',
    badge: {
      bg: 'bg-fuchsia-500/15',
      text: 'text-fuchsia-400',
      border: 'border-fuchsia-500/25',
      shadow: 'shadow-[0_0_15px_rgba(217,70,239,0.2)]',
    },
  },
  {
    name: 'purple',
    bg: 'bg-purple-500',
    text: 'text-purple-400',
    border: 'border-purple-500',
    gradient: 'from-purple-500 to-purple-400',
    dot: 'bg-purple-500',
    badge: {
      bg: 'bg-purple-500/15',
      text: 'text-purple-400',
      border: 'border-purple-500/25',
      shadow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]',
    },
  },
  {
    name: 'violet',
    bg: 'bg-violet-500',
    text: 'text-violet-400',
    border: 'border-violet-500',
    gradient: 'from-violet-500 to-violet-400',
    dot: 'bg-violet-500',
    badge: {
      bg: 'bg-violet-500/15',
      text: 'text-violet-400',
      border: 'border-violet-500/25',
      shadow: 'shadow-[0_0_15px_rgba(139,92,246,0.2)]',
    },
  },
  {
    name: 'indigo',
    bg: 'bg-indigo-500',
    text: 'text-indigo-400',
    border: 'border-indigo-500',
    gradient: 'from-indigo-500 to-indigo-400',
    dot: 'bg-indigo-500',
    badge: {
      bg: 'bg-indigo-500/15',
      text: 'text-indigo-400',
      border: 'border-indigo-500/25',
      shadow: 'shadow-[0_0_15px_rgba(99,102,241,0.2)]',
    },
  },
  {
    name: 'blue',
    bg: 'bg-blue-500',
    text: 'text-blue-400',
    border: 'border-blue-500',
    gradient: 'from-blue-500 to-blue-400',
    dot: 'bg-blue-500',
    badge: {
      bg: 'bg-blue-500/15',
      text: 'text-blue-400',
      border: 'border-blue-500/25',
      shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]',
    },
  },
  {
    name: 'sky',
    bg: 'bg-sky-500',
    text: 'text-sky-400',
    border: 'border-sky-500',
    gradient: 'from-sky-500 to-sky-400',
    dot: 'bg-sky-500',
    badge: {
      bg: 'bg-sky-500/15',
      text: 'text-sky-400',
      border: 'border-sky-500/25',
      shadow: 'shadow-[0_0_15px_rgba(14,165,233,0.2)]',
    },
  },
  {
    name: 'yellow',
    bg: 'bg-yellow-500',
    text: 'text-yellow-400',
    border: 'border-yellow-500',
    gradient: 'from-yellow-500 to-yellow-400',
    dot: 'bg-yellow-500',
    badge: {
      bg: 'bg-yellow-500/15',
      text: 'text-yellow-400',
      border: 'border-yellow-500/25',
      shadow: 'shadow-[0_0_15px_rgba(234,179,8,0.2)]',
    },
  },
  {
    name: 'stone',
    bg: 'bg-stone-500',
    text: 'text-stone-400',
    border: 'border-stone-500',
    gradient: 'from-stone-500 to-stone-400',
    dot: 'bg-stone-500',
    badge: {
      bg: 'bg-stone-500/15',
      text: 'text-stone-400',
      border: 'border-stone-500/25',
      shadow: 'shadow-[0_0_15px_rgba(120,113,108,0.2)]',
    },
  },
];

// ============================================================================
// SYSTEM COLORS - Neutral for system categories
// ============================================================================
interface SystemColors {
  uncategorized: CategoryColor;
  transfer: CategoryColor;
  system: CategoryColor;
}

const SYSTEM_COLORS: SystemColors = {
  // Amber for Uncategorized (NOT red - red conflicts with negative amounts)
  uncategorized: {
    name: 'amber',
    bg: 'bg-amber-500',
    text: 'text-amber-400',
    border: 'border-amber-500',
    gradient: 'from-amber-500 to-amber-400',
    dot: 'bg-amber-500',
    badge: {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/25',
      shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    },
  },
  // Zinc for transfers/internal
  transfer: {
    name: 'zinc',
    bg: 'bg-zinc-500',
    text: 'text-secondary',
    border: 'border-zinc-500',
    gradient: 'from-zinc-500 to-zinc-400',
    dot: 'bg-zinc-500',
    badge: {
      bg: 'bg-zinc-500/15',
      text: 'text-secondary',
      border: 'border-zinc-500/25',
      shadow: 'shadow-[0_0_15px_rgba(113,113,122,0.2)]',
    },
  },
  // Slate for system operations
  system: {
    name: 'slate',
    bg: 'bg-slate-500',
    text: 'text-slate-400',
    border: 'border-slate-500',
    gradient: 'from-slate-500 to-slate-400',
    dot: 'bg-slate-500',
    badge: {
      bg: 'bg-slate-500/15',
      text: 'text-slate-400',
      border: 'border-slate-500/25',
      shadow: 'shadow-[0_0_15px_rgba(100,116,139,0.2)]',
    },
  },
};

// Default color for empty/null categories
const DEFAULT_COLOR = SYSTEM_COLORS.uncategorized;

// ============================================================================
// PRE-ASSIGNED COLOR MAP
// Build the mapping from CATEGORIES definitions
// ============================================================================
const CATEGORY_COLOR_MAP: Record<string, CategoryColor> = {};

// Track indices for even distribution
let revenueColorIndex = 0;
let expenseColorIndex = 0;

// Process all categories and assign colors based on type
CATEGORIES.forEach((category: CategoryDefinition) => {
  const categoryName = category.name;

  switch (category.type) {
    case 'revenue':
      // Assign from green family
      CATEGORY_COLOR_MAP[categoryName] =
        REVENUE_COLORS[revenueColorIndex % REVENUE_COLORS.length] ?? DEFAULT_COLOR;
      revenueColorIndex++;
      break;

    case 'expense':
    case 'cogs':
      // Assign from warm spectrum
      CATEGORY_COLOR_MAP[categoryName] =
        EXPENSE_COLORS[expenseColorIndex % EXPENSE_COLORS.length] ?? DEFAULT_COLOR;
      expenseColorIndex++;
      break;

    case 'system':
      // Uncategorized gets amber
      if (categoryName === 'Uncategorized') {
        CATEGORY_COLOR_MAP[categoryName] = SYSTEM_COLORS.uncategorized ?? DEFAULT_COLOR;
      } else {
        CATEGORY_COLOR_MAP[categoryName] = SYSTEM_COLORS.system ?? DEFAULT_COLOR;
      }
      break;

    default:
      // Fallback to expense colors for unknown types
      CATEGORY_COLOR_MAP[categoryName] =
        EXPENSE_COLORS[expenseColorIndex % EXPENSE_COLORS.length] ?? DEFAULT_COLOR;
      expenseColorIndex++;
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get the color definition for a category
 * @param category - The category name
 * @returns CategoryColor object with all color classes
 */
export function getCategoryColor(category: string): CategoryColor {
  // Handle empty/null/undefined
  if (!category) {
    return DEFAULT_COLOR;
  }

  // Check pre-assigned map first
  const mapped = CATEGORY_COLOR_MAP[category];
  if (mapped) {
    return mapped;
  }

  // Hash fallback for unknown categories (not in CATEGORIES list)
  // Uses expense colors as default for unknown categories
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % EXPENSE_COLORS.length;
  return EXPENSE_COLORS[index] ?? DEFAULT_COLOR;
}

/**
 * Get all revenue colors
 */
export function getRevenueColors(): readonly CategoryColor[] {
  return REVENUE_COLORS;
}

/**
 * Get all expense colors
 */
export function getExpenseColors(): readonly CategoryColor[] {
  return EXPENSE_COLORS;
}

/**
 * Get system colors
 */
export function getSystemColors(): Readonly<SystemColors> {
  return SYSTEM_COLORS;
}

/**
 * Get the full pre-assigned category color map
 */
export function getCategoryColorMap(): Readonly<Record<string, CategoryColor>> {
  return CATEGORY_COLOR_MAP;
}

/**
 * Check if a category is a revenue category (for styling purposes)
 */
export function isRevenueCategory(category: string): boolean {
  const categoryDef = CATEGORIES.find((c) => c.name === category);
  return categoryDef?.type === 'revenue';
}

/**
 * Check if a category is an expense category (for styling purposes)
 */
export function isExpenseCategory(category: string): boolean {
  const categoryDef = CATEGORIES.find((c) => c.name === category);
  return categoryDef?.type === 'expense' || categoryDef?.type === 'cogs';
}

/**
 * Check if a category is a system category (for styling purposes)
 */
export function isSystemCategory(category: string): boolean {
  const categoryDef = CATEGORIES.find((c) => c.name === category);
  return categoryDef?.type === 'system';
}
