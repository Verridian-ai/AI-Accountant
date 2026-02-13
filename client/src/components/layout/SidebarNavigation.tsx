import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavSections } from '@/routes';

interface SidebarNavigationProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function SidebarNavigation({
  collapsed = false,
  onCollapsedChange,
}: SidebarNavigationProps) {
  const sections = getNavSections();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of sections) {
      initial[section.title] = true;
    }
    return initial;
  });

  const toggleSection = (title: string) => {
    if (collapsed) return;
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-[#0d0d14] border-r border-white/5 transition-all duration-200 ease-in-out shrink-0 overflow-hidden',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-4 border-b border-white/5 shrink-0',
          collapsed && 'justify-center px-2'
        )}
      >
        <img
          src="/cba-logo.svg"
          alt="GoldLedger"
          className="h-9 w-9 shrink-0 drop-shadow-[0_0_8px_rgba(255,204,0,0.3)]"
        />
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-base font-bold tracking-tight text-gradient-gold whitespace-nowrap">
              GoldLedger
            </h1>
            <p className="text-[9px] text-zinc-500 uppercase tracking-[0.15em] font-semibold whitespace-nowrap">
              Financial Intelligence
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin" aria-label="Sidebar navigation">
        {sections.map((section) => {
          const isExpanded = expandedSections[section.title] ?? true;

          return (
            <div key={section.title} className="mb-1">
              {/* Section header */}
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  <span>{section.title}</span>
                  <ChevronRight
                    className={cn(
                      'h-3 w-3 transition-transform duration-200',
                      isExpanded && 'rotate-90'
                    )}
                  />
                </button>
              )}

              {/* Items */}
              {(collapsed || isExpanded) && (
                <div className="space-y-0.5 px-2">
                  {section.items.map((item) => (
                    <SidebarItem
                      key={item.navId}
                      to={item.path}
                      icon={item.icon}
                      label={item.label}
                      collapsed={collapsed}
                      end={item.path === '/'}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="shrink-0 border-t border-white/5 p-2">
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all duration-200',
            collapsed && 'justify-center px-0'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium whitespace-nowrap">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  end?: boolean;
}

function SidebarItem({ to, icon: Icon, label, collapsed, end }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'w-full flex items-center gap-3 rounded-xl transition-all duration-200 group relative',
          collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
          isActive
            ? 'text-[#FFCC00] bg-[#FFCC00]/10'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Gold active indicator */}
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[#FFCC00] shadow-[0_0_8px_rgba(255,204,0,0.4)]" />
          )}

          <Icon className={cn('h-5 w-5 shrink-0', isActive && 'drop-shadow-[0_0_4px_rgba(255,204,0,0.3)]')} />

          {!collapsed && (
            <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              {label}
            </span>
          )}

          {/* Tooltip when collapsed */}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-xs font-medium text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-lg z-50">
              {label}
            </div>
          )}
        </>
      )}
    </NavLink>
  );
}
