import { Activity, BarChart3, FileText, Wallet, Brain, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabId = 'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax';

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

                {/* Central Agent Button - Floating */}
                <div className="relative z-10 -top-6 px-2">
                    <button
                        onClick={onShowAgents}
                        aria-label="Open AI Agents"
                        className="group relative w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-95"
                    >
                        <div className="absolute inset-0 bg-[#FFCC00] rounded-full blur opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse-glow" />
                        <div className="absolute inset-0 bg-linear-to-br from-[#FFCC00] to-[#E6B800] rounded-full shadow-[0_4px_20px_rgba(255,204,0,0.4)] border border-[#FFE066]" />
                        <div className="relative z-10 text-[#0a0a0f]">
                            <Brain className="h-7 w-7" />
                        </div>
                    </button>
                    <div className="text-[9px] font-black text-center mt-1 text-[#FFCC00] uppercase tracking-widest opacity-80">
                        Agent
                    </div>
                </div>

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
