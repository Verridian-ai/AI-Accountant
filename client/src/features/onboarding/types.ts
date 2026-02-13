// Onboarding Types

export interface OnboardingData {
  // Business Profile
  businessName: string;
  entityType: 'sole_trader' | 'company' | 'partnership' | 'trust' | 'individual';
  abn: string;
  industry: string;

  // Tax Setup
  isRegisteredForGst: boolean;
  basFrequency: 'monthly' | 'quarterly' | 'annually';
  accountingMethod: 'cash' | 'accrual';
  financialYearEnd: 'june' | 'december';

  // Categories
  customCategories: string[];

  // Goals
  selectedGoals: string[];

  // Statement
  hasUploadedStatement: boolean;

  // Meta
  completedSteps: number[];
  currentStep: number;
  startedAt: string;
  completedAt: string | null;
}

export interface OnboardingStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  isFirstStep?: boolean;
  isLastStep?: boolean;
}

export const ENTITY_TYPES = [
  { id: 'individual', label: 'Individual', description: 'Personal finances' },
  { id: 'sole_trader', label: 'Sole Trader', description: 'Self-employed business' },
  { id: 'company', label: 'Company', description: 'Pty Ltd or Ltd company' },
  { id: 'partnership', label: 'Partnership', description: 'Business partnership' },
  { id: 'trust', label: 'Trust', description: 'Family or business trust' },
] as const;

export const INDUSTRIES = [
  'Agriculture',
  'Construction',
  'Consulting',
  'E-commerce',
  'Education',
  'Finance & Insurance',
  'Healthcare',
  'Hospitality',
  'Information Technology',
  'Manufacturing',
  'Professional Services',
  'Real Estate',
  'Retail',
  'Transport & Logistics',
  'Other',
] as const;

export const DEFAULT_CATEGORIES = [
  'Advertising & Marketing',
  'Bank Fees',
  'Business Insurance',
  'Client Entertainment',
  'Communication (Phone/Internet)',
  'Depreciation',
  'Education & Training',
  'Equipment & Tools',
  'Income - Sales',
  'Income - Services',
  'Interest Expense',
  'Legal & Accounting',
  'Motor Vehicle',
  'Office Supplies',
  'Rent & Lease',
  'Repairs & Maintenance',
  'Software & Subscriptions',
  'Superannuation',
  'Travel - Domestic',
  'Travel - International',
  'Utilities',
  'Wages & Salaries',
] as const;

export const FINANCIAL_GOALS = [
  {
    id: 'tax_optimization',
    label: 'Optimize Tax Deductions',
    icon: 'receipt',
    description: 'Maximize legitimate deductions',
  },
  {
    id: 'bas_compliance',
    label: 'BAS Compliance',
    icon: 'calculator',
    description: 'Stay on top of GST obligations',
  },
  {
    id: 'expense_tracking',
    label: 'Track Expenses',
    icon: 'trending-down',
    description: 'Understand where money goes',
  },
  {
    id: 'income_growth',
    label: 'Grow Income',
    icon: 'trending-up',
    description: 'Monitor revenue trends',
  },
  { id: 'cash_flow', label: 'Manage Cash Flow', icon: 'wallet', description: 'Ensure liquidity' },
  {
    id: 'debt_reduction',
    label: 'Reduce Debt',
    icon: 'minus-circle',
    description: 'Pay down liabilities faster',
  },
  {
    id: 'savings_goals',
    label: 'Build Savings',
    icon: 'piggy-bank',
    description: 'Accumulate reserves',
  },
  {
    id: 'investment_tracking',
    label: 'Track Investments',
    icon: 'bar-chart',
    description: 'Monitor portfolio performance',
  },
] as const;

export const ONBOARDING_STORAGE_KEY = 'cba-onboarding-progress';

export const createInitialOnboardingData = (): OnboardingData => ({
  businessName: '',
  entityType: 'individual',
  abn: '',
  industry: '',
  isRegisteredForGst: false,
  basFrequency: 'quarterly',
  accountingMethod: 'cash',
  financialYearEnd: 'june',
  customCategories: [],
  selectedGoals: [],
  hasUploadedStatement: false,
  completedSteps: [],
  currentStep: 0,
  startedAt: new Date().toISOString(),
  completedAt: null,
});
