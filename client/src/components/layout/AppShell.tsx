import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { SidebarNavigation } from './SidebarNavigation';
import { MobileNavigation } from './MobileNavigation';
import { HeaderBar } from './HeaderBar';
import { OfflineIndicator } from '../../features/offline';
import { usePageTitle } from '@/hooks/usePageTitle';

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

const SIDEBAR_COLLAPSED_KEY = 'goldledger-sidebar-collapsed';

function loadCollapsedState(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

interface AppShellProps {
  children: ReactNode;
  /** User info */
  username?: string;
  lastSynced?: Date | null;
  loading?: boolean;
  /** Callbacks */
  onRefresh?: () => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onOpenMerchantMemory?: () => void;
  onScan?: () => void;
  /** Rendered TenantSwitcher component */
  tenantSwitcher?: ReactNode;
}

export function AppShell({
  children,
  username,
  lastSynced,
  loading,
  onRefresh,
  onLogout,
  onOpenSettings,
  onOpenMerchantMemory,
  onScan,
  tenantSwitcher,
}: AppShellProps) {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadCollapsedState);
  const pageTitle = usePageTitle();

  // Listen for viewport changes
  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 767px)');
    const mqTablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');

    const update = () => setBreakpoint(getBreakpoint());

    mqMobile.addEventListener('change', update);
    mqTablet.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      mqMobile.removeEventListener('change', update);
      mqTablet.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const handleCollapsedChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // localStorage might be unavailable
    }
  }, []);

  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const showSidebar = !isMobile;
  const effectiveCollapsed = isTablet || sidebarCollapsed;

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {/* Sidebar: tablet (collapsed) or desktop */}
      {showSidebar && (
        <SidebarNavigation
          collapsed={effectiveCollapsed}
          onCollapsedChange={isTablet ? undefined : handleCollapsedChange}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <HeaderBar
          pageTitle={pageTitle}
          username={username}
          lastSynced={lastSynced}
          loading={loading}
          onRefresh={onRefresh}
          onLogout={onLogout}
          onOpenSettings={onOpenSettings}
          onOpenMerchantMemory={onOpenMerchantMemory}
          hasSidebar={showSidebar}
          tenantSwitcher={tenantSwitcher}
        />

        {/* Offline / syncing indicator */}
        <OfflineIndicator />

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={isMobile ? { paddingBottom: 80 } : undefined}
        >
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile: Bottom navigation */}
      {isMobile && (
        <MobileNavigation onScan={onScan} />
      )}
    </div>
  );
}
