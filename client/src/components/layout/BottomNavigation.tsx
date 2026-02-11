import { Activity, BarChart3, FileText, Wallet, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabId = 'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax' | 'gst' | 'transfers';

interface BottomNavigationProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
    onShowAgents: () => void;
}

export function BottomNavigation({ activeTab, onTabChange, onShowAgents }: BottomNavigationProps) {
    const navItems: { id: TabId; label: string; icon: typeof Activity }[] = [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'transactions', label: 'Ledger', icon: FileText },
        // Middle button is handled separately
        { id: 'accounts', label: 'Vaults', icon: Wallet },
        { id: 'analytics', label: 'Insights', icon: BarChart3 },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom">
            {/* Glass Background with Blur */}
            <div className="absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" />

            {/* Central Agent Button - Floating above nav */}
            <button
                onClick={onShowAgents}
                aria-label="Open AI Agents"
                className="absolute left-1/2 -translate-x-1/2 -top-6 z-20 group flex flex-col items-center gap-1 transition-transform active:scale-95"
            >
                <img src="/cba-logo.svg" alt="GoldLedger" className="h-16 w-16 drop-shadow-[0_4px_28px_rgba(255,204,0,0.4)] group-hover:drop-shadow-[0_4px_36px_rgba(255,204,0,0.6)] transition-all" />
                <span className="text-[10px] font-bold text-[#FFCC00] uppercase tracking-wide">Menu</span>
            </button>

            <div className="relative flex justify-between items-end px-2 pb-2 pt-2">
                {/* Left Side Items */}
                <div className="flex gap-1 flex-1 justify-around">
                    {navItems.slice(0, 2).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300 min-w-[64px]",
                                activeTab === item.id
                                    ? "text-[#FFCC00]"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <div className={cn(
                                "relative p-1.5 rounded-xl transition-all duration-300",
                                activeTab === item.id && "bg-[#FFCC00]/10 ring-1 ring-[#FFCC00]/20 shadow-[0_0_15px_rgba(255,204,0,0.1)]"
                            )}>
                                <item.icon className={cn(
                                    "h-6 w-6 transition-transform duration-300",
                                    activeTab === item.id && "scale-110"
                                )} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-bold tracking-wide transition-all duration-300",
                                activeTab === item.id ? "opacity-100 translate-y-0" : "opacity-70"
                            )}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Spacer for center button */}
                <div className="w-20" />

                {/* Right Side Items */}
                <div className="flex gap-1 flex-1 justify-around">
                    {navItems.slice(2, 4).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300 min-w-[64px]",
                                activeTab === item.id
                                    ? "text-[#FFCC00]"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <div className={cn(
                                "relative p-1.5 rounded-xl transition-all duration-300",
                                activeTab === item.id && "bg-[#FFCC00]/10 ring-1 ring-[#FFCC00]/20 shadow-[0_0_15px_rgba(255,204,0,0.1)]"
                            )}>
                                <item.icon className={cn(
                                    "h-6 w-6 transition-transform duration-300",
                                    activeTab === item.id && "scale-110"
                                )} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-bold tracking-wide transition-all duration-300",
                                activeTab === item.id ? "opacity-100 translate-y-0" : "opacity-70"
                            )}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
