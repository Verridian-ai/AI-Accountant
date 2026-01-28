import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Account, CreditCardAnalytics } from '@/api';
import { api } from '@/api';
import { CreditCard, Wallet, PiggyBank, Building2, Activity, TrendingUp, TrendingDown, DollarSign, Percent, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import './AccountHoverCard.css';

interface AccountHoverCardProps {
    account: Account | null;
    accountId: string | null | undefined;
    accounts: Account[];
    children: React.ReactNode;
}

const ACCOUNT_ICONS: Record<string, React.ElementType> = {
    checking: Wallet,
    savings: PiggyBank,
    credit_card: CreditCard,
    loan: Building2,
    investment: Activity,
    other: Wallet,
};

const formatCurrency = (cents: number | null | undefined): string => {
    if (cents === null || cents === undefined) return '$0.00';
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(cents / 100);
};

// Helper to calculate popup position
const calculatePosition = (containerEl: HTMLDivElement | null): 'top' | 'bottom' => {
    if (!containerEl) return 'top';
    const rect = containerEl.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    return spaceAbove > spaceBelow && spaceAbove > 250 ? 'top' : 'bottom';
};

export function AccountHoverCard({ account: propAccount, accountId, accounts, children }: AccountHoverCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [analytics, setAnalytics] = useState<CreditCardAnalytics | null>(null);
    const [loading, setLoading] = useState(false);
    const [position, setPosition] = useState<'top' | 'bottom'>('top');
    const containerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const analyticsLoadedRef = useRef<string | null>(null);

    // Find account from accountId if not provided directly
    const account = useMemo(
        () => propAccount || accounts.find(a => a.id === accountId),
        [propAccount, accounts, accountId]
    );

    // Fetch analytics when hovering over a credit card account
    const fetchAnalytics = useCallback(async (accountToFetch: Account) => {
        if (accountToFetch.accountType !== 'credit_card') return;
        if (analyticsLoadedRef.current === accountToFetch.id) return;

        setLoading(true);
        try {
            const data = await api.fetchCreditCardAnalytics(accountToFetch.id);
            setAnalytics(data);
            analyticsLoadedRef.current = accountToFetch.id;
        } catch (error) {
            console.error('Failed to fetch credit card analytics:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleMouseEnter = useCallback(() => {
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(true);
            setPosition(calculatePosition(containerRef.current));
            if (account) {
                fetchAnalytics(account);
            }
        }, 300);
    }, [account, fetchAnalytics]);

    const handleMouseLeave = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setIsHovered(false);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    if (!account) {
        return <>{children}</>;
    }

    const Icon = ACCOUNT_ICONS[account.accountType] || Wallet;
    const isNegative = account.currentBalance !== null && account.currentBalance < 0;

    return (
        <div
            ref={containerRef}
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}

            {isHovered && (
                <div
                    ref={popupRef}
                    className={cn(
                        "absolute z-50 w-72 neu-raised rounded-2xl border border-white/10 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200 account-hover-popup",
                        position === 'top' ? "bottom-full mb-2 left-1/2 -translate-x-1/2" : "top-full mt-2 left-1/2 -translate-x-1/2"
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                        <div className={cn(
                            "neu-inset p-2.5 rounded-xl",
                            account.accountType === 'credit_card' ? "text-purple-400" : "text-[#FFCC00]"
                        )}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-zinc-100 truncate uppercase tracking-tight">
                                {account.accountName}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-zinc-500 tracking-wider">{account.accountNumber}</span>
                                {account.bankName && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                        <span className="text-[9px] font-bold text-zinc-600 italic">{account.bankName}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Balance Section */}
                    <div className="py-3 border-b border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Current Balance</span>
                            <span className={cn(
                                "text-lg font-black tracking-tight",
                                isNegative ? "text-red-400" : "text-emerald-400"
                            )}>
                                {formatCurrency(account.currentBalance)}
                            </span>
                        </div>
                        <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-1">
                            {account.accountType.replace('_', ' ')}
                        </div>
                    </div>

                    {/* Credit Card Analytics (if applicable) */}
                    {account.accountType === 'credit_card' && (
                        <div className="pt-3 space-y-2">
                            {loading ? (
                                <div className="space-y-3 py-2">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-3 w-3 rounded" />
                                                <Skeleton className="h-3 w-24 rounded" />
                                            </div>
                                            <Skeleton className="h-3 w-12 rounded" />
                                        </div>
                                    ))}
                                </div>
                            ) : analytics ? (
                                <>
                                    {/* Credit Limit & Utilization */}
                                    {analytics.creditLimit && (
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="font-bold text-zinc-500 flex items-center gap-1.5">
                                                <CreditCard className="h-3 w-3" /> Credit Limit
                                            </span>
                                            <span className="font-black text-zinc-300">{formatCurrency(analytics.creditLimit)}</span>
                                        </div>
                                    )}
                                    {analytics.utilization !== null && (
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="font-bold text-zinc-500 flex items-center gap-1.5">
                                                <Percent className="h-3 w-3" /> Utilization
                                            </span>
                                            <span className={cn(
                                                "font-black",
                                                analytics.utilization > 80 ? "text-red-400" : analytics.utilization > 50 ? "text-amber-400" : "text-emerald-400"
                                            )}>
                                                {analytics.utilization}%
                                            </span>
                                        </div>
                                    )}
                                    {analytics.interestRate && (
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="font-bold text-zinc-500 flex items-center gap-1.5">
                                                <TrendingUp className="h-3 w-3" /> Interest Rate
                                            </span>
                                            <span className="font-black text-amber-400">{analytics.interestRate}%</span>
                                        </div>
                                    )}
                                    {analytics.totalInterestPaid > 0 && (
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="font-bold text-zinc-500 flex items-center gap-1.5">
                                                <TrendingDown className="h-3 w-3" /> Total Interest Paid
                                            </span>
                                            <span className="font-black text-red-400">{formatCurrency(analytics.totalInterestPaid)}</span>
                                        </div>
                                    )}
                                    {analytics.avgMonthlySpending > 0 && (
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="font-bold text-zinc-500 flex items-center gap-1.5">
                                                <DollarSign className="h-3 w-3" /> Avg Monthly Spend
                                            </span>
                                            <span className="font-black text-zinc-300">{formatCurrency(analytics.avgMonthlySpending)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
                                        <span className="font-bold text-zinc-500 flex items-center gap-1.5">
                                            <Activity className="h-3 w-3" /> Transactions
                                        </span>
                                        <span className="font-black text-zinc-300">{analytics.transactionCount}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>Analytics unavailable</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quick Stats for non-credit card accounts */}
                    {account.accountType !== 'credit_card' && account.interestRate && (
                        <div className="pt-3">
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold text-zinc-500 flex items-center gap-1.5">
                                    <Percent className="h-3 w-3" /> Interest Rate
                                </span>
                                <span className="font-black text-emerald-400">{account.interestRate}%</span>
                            </div>
                        </div>
                    )}

                    {/* Arrow indicator */}
                    <div className={cn(
                        "absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 neu-raised border border-white/10",
                        position === 'top' ? "bottom-0 translate-y-1/2 border-t-0 border-l-0" : "top-0 -translate-y-1/2 border-b-0 border-r-0"
                    )} />
                </div>
            )}
        </div>
    );
}
