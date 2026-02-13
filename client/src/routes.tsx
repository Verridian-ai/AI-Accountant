import { lazy, type ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Wallet,
  LineChart,
  ShieldCheck,
  Calculator,
  GitCompareArrows,
  Receipt,
  LayoutGrid,
  Zap,
  BarChart3,
  Building2,
  CreditCard,
  Users,
  ClipboardList,
} from 'lucide-react';

export type RouteSection =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'tax'
  | 'analytics'
  | 'ai'
  | 'settings';

export interface RouteConfig {
  path: string;
  /** Navigation ID — used to match sidebar/mobile nav active state */
  navId: string;
  label: string;
  icon: LucideIcon;
  section: RouteSection;
  /** Whether this route appears in sidebar/mobile navigation */
  showInNav: boolean;
  /** Lazy-loaded component */
  component: React.LazyExoticComponent<ComponentType>;
}

// Lazy-loaded page wrappers
// Each points to an existing component via dynamic import
const DashboardPage = lazy(() =>
  import('./features/analytics/components/AnalyticsDashboard').then((m) => ({
    default: m.AnalyticsDashboard,
  })),
);

const LedgerPage = lazy(() =>
  import('./features/transactions/components/LedgerPage').then((m) => ({
    default: m.LedgerPage,
  })),
);

const AccountsPage = lazy(() =>
  import('./features/accounts/components/AccountManager').then((m) => ({
    default: m.AccountManager,
  })),
);

const TransfersPage = lazy(() =>
  import('./features/transfers/components/TransfersPage').then((m) => ({
    default: m.TransfersPage,
  })),
);

const TaxDashboardPage = lazy(() =>
  import('./features/tax/components/TaxDashboard').then((m) => ({
    default: m.TaxDashboard,
  })),
);

const BASPage = lazy(() =>
  import('./features/bas/components/BASPage').then((m) => ({
    default: m.BASPage,
  })),
);

const GSTPage = lazy(() =>
  import('./features/gst/components/GSTPage').then((m) => ({
    default: m.GSTPage,
  })),
);

const AnalyticsPage = lazy(() =>
  import('./features/analytics/components/AnalyticsDashboard').then((m) => ({
    default: m.AnalyticsDashboard,
  })),
);

const MarketPage = lazy(() =>
  import('./features/market').then((m) => ({
    default: m.MarketDashboard,
  })),
);

const DashboardGridPage = lazy(() =>
  import('./features/dashboards/components/DashboardGrid').then((m) => ({
    default: m.DashboardGrid,
  })),
);

const StreamingPage = lazy(() =>
  import('./features/streaming/components/MigrationDashboard').then((m) => ({
    default: m.MigrationDashboard,
  })),
);

const SettingsPage = lazy(() =>
  import('./features/tenant/components/TenantSettings').then((m) => ({
    default: m.TenantSettings,
  })),
);

const SubscriptionPage = lazy(() =>
  import('./features/subscription/components/PlanComparison').then((m) => ({
    default: m.PlanComparison as ComponentType,
  })),
);

const PayrollPage = lazy(() =>
  import('./features/payroll/components/PayrollDashboard').then((m) => ({
    default: m.PayrollDashboard,
  })),
);

const APPage = lazy(() =>
  import('./features/ap/components/APDashboard').then((m) => ({
    default: m.APDashboard,
  })),
);

const InvoicingPage = lazy(() =>
  import('./features/invoicing/components/InvoicingDashboard').then((m) => ({
    default: m.InvoicingDashboard,
  })),
);

export const routes: RouteConfig[] = [
  // Dashboard
  {
    path: '/',
    navId: 'dashboard',
    label: 'Home',
    icon: LayoutDashboard,
    section: 'dashboard',
    showInNav: true,
    component: DashboardPage,
  },
  {
    path: '/dashboards',
    navId: 'dashboards',
    label: 'Custom Dashboards',
    icon: LayoutGrid,
    section: 'dashboard',
    showInNav: true,
    component: DashboardGridPage,
  },

  // Transactions
  {
    path: '/transactions',
    navId: 'transactions',
    label: 'Ledger',
    icon: FileText,
    section: 'transactions',
    showInNav: true,
    component: LedgerPage as any,
  },

  // Accounts
  {
    path: '/accounts',
    navId: 'accounts',
    label: 'Account Manager',
    icon: Wallet,
    section: 'accounts',
    showInNav: true,
    component: AccountsPage,
  },
  {
    path: '/transfers',
    navId: 'transfers',
    label: 'Transfers',
    icon: GitCompareArrows,
    section: 'accounts',
    showInNav: true,
    component: TransfersPage,
  },
  {
    path: '/payroll',
    navId: 'payroll',
    label: 'Payroll',
    icon: Users,
    section: 'accounts',
    showInNav: true,
    component: PayrollPage,
  },
  {
    path: '/ap',
    navId: 'ap',
    label: 'Accounts Payable',
    icon: ClipboardList,
    section: 'accounts',
    showInNav: true,
    component: APPage,
  },
  {
    path: '/invoicing',
    navId: 'invoicing',
    label: 'Invoicing',
    icon: FileText,
    section: 'accounts',
    showInNav: true,
    component: InvoicingPage,
  },

  // Tax & BAS
  {
    path: '/tax',
    navId: 'tax',
    label: 'Tax Dashboard',
    icon: Receipt,
    section: 'tax',
    showInNav: true,
    component: TaxDashboardPage,
  },
  {
    path: '/bas',
    navId: 'bas',
    label: 'BAS Dashboard',
    icon: Calculator,
    section: 'tax',
    showInNav: true,
    component: BASPage,
  },
  {
    path: '/gst',
    navId: 'gst',
    label: 'GST',
    icon: ShieldCheck,
    section: 'tax',
    showInNav: true,
    component: GSTPage,
  },

  // Analytics
  {
    path: '/analytics',
    navId: 'analytics',
    label: 'Insights',
    icon: LineChart,
    section: 'analytics',
    showInNav: true,
    component: AnalyticsPage,
  },
  {
    path: '/market',
    navId: 'market',
    label: 'Market',
    icon: BarChart3,
    section: 'analytics',
    showInNav: true,
    component: MarketPage,
  },

  // AI & Tools
  {
    path: '/streaming',
    navId: 'streaming',
    label: 'AI SDK',
    icon: Zap,
    section: 'ai',
    showInNav: true,
    component: StreamingPage,
  },

  // Settings
  {
    path: '/settings',
    navId: 'settings',
    label: 'Settings',
    icon: Building2,
    section: 'settings',
    showInNav: true,
    component: SettingsPage,
  },
  {
    path: '/subscription',
    navId: 'subscription',
    label: 'Plans',
    icon: CreditCard,
    section: 'settings',
    showInNav: true,
    component: SubscriptionPage,
  },
];

/** Map of navId/path to page title */
export const pageTitles: Record<string, string> = {};
for (const route of routes) {
  pageTitles[route.path] = route.label;
  pageTitles[route.navId] = route.label;
}

/** Get route sections for navigation building */
export function getNavSections(): { title: string; items: RouteConfig[] }[] {
  const sectionLabels: Record<RouteSection, string> = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    accounts: 'Accounts',
    tax: 'Tax & BAS',
    analytics: 'Analytics',
    ai: 'AI & Tools',
    settings: 'Settings',
  };

  const sectionOrder: RouteSection[] = [
    'dashboard',
    'transactions',
    'accounts',
    'tax',
    'analytics',
    'ai',
    'settings',
  ];

  return sectionOrder.map((section) => ({
    title: sectionLabels[section],
    items: routes.filter((r) => r.section === section && r.showInNav),
  }));
}
