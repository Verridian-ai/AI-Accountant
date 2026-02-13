import {
  Search,
  RefreshCw,
  LogOut,
  Brain,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import { NotificationCenter } from '../../features/notifications';
import { cn } from '@/lib/utils';

interface HeaderBarProps {
  /** Current page title (shown on mobile) */
  pageTitle?: string;
  /** User display name */
  username?: string;
  /** Last sync time */
  lastSynced?: Date | null;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Callback handlers */
  onRefresh?: () => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onOpenMerchantMemory?: () => void;
  /** Whether the sidebar is visible (desktop/tablet) */
  hasSidebar?: boolean;
  /** TenantSwitcher React element (rendered in desktop mode) */
  tenantSwitcher?: React.ReactNode;
}

export function HeaderBar({
  pageTitle = 'GoldLedger',
  username,
  lastSynced,
  loading = false,
  onRefresh,
  onLogout,
  onOpenSettings,
  onOpenMerchantMemory,
  hasSidebar = false,
  tenantSwitcher,
}: HeaderBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 neu-raised border-b border-[#FFCC00]/10',
        'bg-[#0d0d14]/95 backdrop-blur-xl'
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        {/* Left: Logo (mobile) or TenantSwitcher (desktop) */}
        <div className="flex items-center gap-3 shrink-0">
          {!hasSidebar && (
            <img
              src="/cba-logo.svg"
              alt="GoldLedger"
              className="h-8 w-8 drop-shadow-[0_0_8px_rgba(255,204,0,0.3)] md:hidden"
            />
          )}
          {/* Desktop: Tenant Switcher */}
          <div className="hidden md:block">{tenantSwitcher}</div>
        </div>

        {/* Center: Page title (mobile) or Search (desktop) */}
        <div className="flex-1 flex justify-center min-w-0">
          {/* Mobile title */}
          <h1 className="md:hidden text-sm font-bold text-zinc-200 truncate">
            {pageTitle}
          </h1>
          {/* Desktop search placeholder */}
          <div className="hidden md:flex items-center gap-2 neu-inset rounded-xl px-4 py-2 w-full max-w-md text-zinc-500 text-sm">
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search transactions, accounts...</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sync indicator - desktop only */}
          {lastSynced && (
            <div className="hidden lg:flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest neu-inset px-3 py-1.5 rounded-full text-zinc-500 mr-1">
              <span className="w-1.5 h-1.5 rounded-full cba-gold-bg animate-pulse" />
              {lastSynced.toLocaleTimeString()}
            </div>
          )}

          {/* User badge - desktop only */}
          {username && (
            <span className="hidden xl:flex items-center gap-2 text-xs text-zinc-400 font-medium neu-raised-sm px-3 py-1.5 rounded-xl mr-1">
              <User className="h-3.5 w-3.5" />
              {username}
            </span>
          )}

          {/* Merchant Memory - desktop only */}
          {onOpenMerchantMemory && (
            <button
              type="button"
              title="Merchant Memory"
              aria-label="Open merchant memory"
              onClick={onOpenMerchantMemory}
              className="hidden sm:flex neu-raised-sm p-2 text-zinc-400 hover:text-[#FFCC00] hover:cba-gold-glow rounded-xl btn-press"
            >
              <Brain className="h-4 w-4" />
            </button>
          )}

          {/* Notifications */}
          <NotificationCenter />

          {/* Settings - desktop only */}
          {onOpenSettings && (
            <button
              type="button"
              title="Settings"
              aria-label="Open settings"
              onClick={onOpenSettings}
              className="hidden sm:flex neu-raised-sm p-2 text-zinc-400 hover:text-[#FFCC00] hover:cba-gold-glow rounded-xl btn-press"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          )}

          {/* Refresh */}
          {onRefresh && (
            <button
              type="button"
              title="Refresh data"
              aria-label="Refresh data"
              onClick={onRefresh}
              className="hidden sm:flex neu-raised-sm p-2 text-zinc-400 hover:text-emerald-400 hover:glow-success rounded-xl btn-press"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          )}

          {/* Logout */}
          {onLogout && (
            <button
              type="button"
              title="Logout"
              aria-label="Logout"
              onClick={onLogout}
              className="neu-raised-sm p-2 text-zinc-400 hover:text-red-400 hover:glow-danger rounded-xl btn-press"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
