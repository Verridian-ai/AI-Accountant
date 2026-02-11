import type { ReactNode } from 'react';
import { Filter, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
    onFilterClick?: () => void;
    onAddClick?: () => void;
    activeFiltersCount?: number;
    summaryStats?: ReactNode;
}

export function MobileLayout({
    children,
    title,
    subtitle,
    onFilterClick,
    onAddClick,
    activeFiltersCount = 0,
    summaryStats
}: MobileLayoutProps) {
    return (
        <div className="flex flex-col min-h-[calc(100vh-80px)] pb-20 md:hidden">
            {/* Sticky Mobile Header */}
            <div className="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/5 pb-2">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/cba-logo.svg" alt="GoldLedger" className="h-[48px] w-[48px] drop-shadow-[0_0_8px_rgba(255,204,0,0.3)]" />
                        <div>
                            <h1 className="text-lg font-black text-white uppercase tracking-tight">{title}</h1>
                            {subtitle && <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{subtitle}</p>}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {onFilterClick && (
                            <button
                                onClick={onFilterClick}
                                className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                    activeFiltersCount > 0
                                        ? "cba-gold-gradient text-black shadow-lg shadow-[#FFCC00]/20"
                                        : "neu-raised-sm text-zinc-500 border border-white/5"
                                )}
                            >
                                <Filter className="h-5 w-5" />
                                {activeFiltersCount > 0 && (
                                    <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0f]" />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary Stats Bar */}
                {summaryStats && (
                    <div className="px-4 overflow-x-auto scrollbar-hide">
                        <div className="flex gap-3 pb-2 min-w-max">
                            {summaryStats}
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 px-4 py-4 space-y-4">
                {children}
            </div>

            {/* Mobile Bottom FAB (Floating Action Button) */}
            {onAddClick && (
                <button
                    onClick={onAddClick}
                    className="fixed bottom-24 right-4 w-14 h-14 cba-gold-gradient rounded-full shadow-2xl shadow-[#FFCC00]/30 flex items-center justify-center text-black z-50 active:scale-95 transition-transform"
                >
                    <Plus className="h-7 w-7" />
                </button>
            )}
        </div>
    );
}