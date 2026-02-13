import { useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Camera,
  LineChart,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavigationDrawer } from './NavigationDrawer';

interface MobileTab {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  isSpecial?: boolean;
}

const mobileTabs: MobileTab[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, path: '/' },
  { id: 'transactions', label: 'Ledger', icon: FileText, path: '/transactions' },
  { id: '__scan__', label: 'Scan', icon: Camera, isSpecial: true },
  { id: 'analytics', label: 'Insights', icon: LineChart, path: '/analytics' },
  { id: '__more__', label: 'More', icon: MoreHorizontal },
];

interface MobileNavigationProps {
  onScan?: () => void;
}

export function MobileNavigation({ onScan }: MobileNavigationProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSpecialPress = useCallback(
    (tab: MobileTab) => {
      if (tab.id === '__more__') {
        setIsDrawerOpen(true);
        return;
      }
      if (tab.id === '__scan__') {
        onScan?.();
        return;
      }
    },
    [onScan],
  );

  return (
    <>
      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Glass background */}
        <div className="absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" />

        <nav
          className="relative flex items-end justify-around px-2 pt-2"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
          aria-label="Main navigation"
        >
          {mobileTabs.map((tab) => {
            // Special scan button (no link)
            if (tab.isSpecial) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSpecialPress(tab)}
                  className="flex flex-col items-center gap-1 -mt-4 transition-transform active:scale-95"
                  aria-label={tab.label}
                  style={{ minWidth: 56, minHeight: 56 }}
                >
                  <div className="w-14 h-14 rounded-full cba-gold-gradient flex items-center justify-center shadow-[0_4px_20px_rgba(255,204,0,0.4)]">
                    <tab.icon className="h-6 w-6 text-black" />
                  </div>
                  <span className="text-[10px] font-bold text-[#FFCC00] uppercase tracking-wide">
                    {tab.label}
                  </span>
                </button>
              );
            }

            // "More" button (opens drawer, no link)
            if (tab.id === '__more__') {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSpecialPress(tab)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300 text-zinc-500 hover:text-zinc-300"
                  aria-label={tab.label}
                  style={{ minWidth: 56, minHeight: 44 }}
                >
                  <div className="relative p-1.5 rounded-xl transition-all duration-300">
                    <tab.icon className="h-6 w-6 transition-transform duration-300" />
                  </div>
                  <span className="text-[10px] font-bold tracking-wide transition-all duration-300 opacity-70">
                    {tab.label}
                  </span>
                </button>
              );
            }

            // Regular NavLink tab
            const isExactHome = tab.path === '/';

            return (
              <NavLink
                key={tab.id}
                to={tab.path ?? '/'}
                end={isExactHome}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300',
                    isActive ? 'text-[#FFCC00]' : 'text-zinc-500 hover:text-zinc-300',
                  )
                }
                aria-label={tab.label}
                style={{ minWidth: 56, minHeight: 44 }}
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        'relative p-1.5 rounded-xl transition-all duration-300',
                        isActive &&
                          'bg-[#FFCC00]/10 ring-1 ring-[#FFCC00]/20 shadow-[0_0_15px_rgba(255,204,0,0.1)]',
                      )}
                    >
                      <tab.icon
                        className={cn(
                          'h-6 w-6 transition-transform duration-300',
                          isActive && 'scale-110',
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold tracking-wide transition-all duration-300',
                        isActive ? 'opacity-100' : 'opacity-70',
                      )}
                    >
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Navigation Drawer */}
      <NavigationDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}
