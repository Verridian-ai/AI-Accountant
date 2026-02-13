import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    ArrowLeft,
    Loader2,
    Zap,
    CheckCircle2,
    XCircle,
    AlertCircle,
    MinusCircle,
} from 'lucide-react';
import { reconApi } from '@/api';
import { cn } from '@/lib/utils';
import { ReconMatchSuggestions } from './ReconMatchSuggestions';
import type { BankTransaction, MatchSuggestion } from './ReconMatchSuggestions';

interface ReconSession {
    id: string;
    accountId: string;
    accountName: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    statementBalanceCents?: number;
    ledgerBalanceCents?: number;
    matchedCount: number;
    unmatchedCount: number;
    differenceAmount?: number;
    bankTransactions?: BankTransaction[];
    ledgerEntries?: LedgerEntry[];
    matches?: MatchSuggestion[];
}

interface LedgerEntry {
    id: string;
    reference: string;
    date: string;
    amount: number;
    description: string;
    matchStatus: 'confirmed' | 'suggested' | 'rejected' | 'unmatched';
}

interface ReconMatchingWorkspaceProps {
    sessionId: string;
    onBack: () => void;
}

const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    suggested: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    unmatched: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const statusIcons: Record<string, typeof CheckCircle2> = {
    confirmed: CheckCircle2,
    suggested: AlertCircle,
    rejected: XCircle,
    unmatched: MinusCircle,
};

export function ReconMatchingWorkspace({ sessionId, onBack }: ReconMatchingWorkspaceProps) {
    const [session, setSession] = useState<ReconSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoMatching, setAutoMatching] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [selectedBankTx, setSelectedBankTx] = useState<BankTransaction | null>(null);
    const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);

    useEffect(() => {
        loadSession();
    }, [sessionId]);

    const loadSession = async () => {
        setLoading(true);
        try {
            const data = await reconApi.getSession(sessionId);
            setSession(data);
        } catch (err) {
            console.error('Failed to load session:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoMatch = async () => {
        setAutoMatching(true);
        try {
            await reconApi.autoMatch(sessionId);
            await loadSession();
        } catch (err) {
            console.error('Auto-match failed:', err);
        } finally {
            setAutoMatching(false);
        }
    };

    const handleComplete = async () => {
        setCompleting(true);
        try {
            await reconApi.completeSession(sessionId);
            onBack();
        } catch (err) {
            console.error('Failed to complete session:', err);
        } finally {
            setCompleting(false);
        }
    };

    const handleSelectBankTx = (tx: BankTransaction) => {
        setSelectedBankTx(tx);
        // Filter suggestions for this transaction
        const txSuggestions = (session?.matches ?? []).filter(
            (m) => m.matchId.includes(tx.id) || true // Show all available suggestions
        );
        setSuggestions(txSuggestions);
    };

    const handleConfirmMatch = async (_matchId: string) => {
        await loadSession();
        setSelectedBankTx(null);
        setSuggestions([]);
    };

    const handleRejectMatch = async (_matchId: string) => {
        await loadSession();
    };

    const handleManualMatch = async (_bankTxId: string, _ledgerEntryId: string) => {
        await loadSession();
        setSelectedBankTx(null);
        setSuggestions([]);
    };

    const handleMarkNoMatch = (_bankTxId: string) => {
        // Mark as reviewed but unmatched
        setSelectedBankTx(null);
        setSuggestions([]);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[#FFCC00]" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="text-center py-16">
                <p className="text-zinc-500">Session not found</p>
                <Button variant="ghost" size="sm" onClick={onBack} className="mt-2">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
            </div>
        );
    }

    const bankTransactions = session.bankTransactions ?? [];
    const ledgerEntries = session.ledgerEntries ?? [];
    const totalItems = session.matchedCount + session.unmatchedCount;
    const matchPercent = totalItems > 0 ? Math.round((session.matchedCount / totalItems) * 100) : 0;
    const statementBalance = session.statementBalanceCents ?? 0;
    const ledgerBalance = session.ledgerBalanceCents ?? 0;
    const difference = session.differenceAmount ?? (statementBalance - ledgerBalance);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <div>
                        <h3 className="text-lg font-bold text-zinc-200">
                            {session.accountName ?? 'Reconciliation'}
                        </h3>
                        <p className="text-xs text-zinc-500">
                            {session.periodStart} to {session.periodEnd}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90"
                        onClick={handleAutoMatch}
                        disabled={autoMatching}
                    >
                        {autoMatching ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                            <Zap className="h-4 w-4 mr-1" />
                        )}
                        Auto-Match
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={handleComplete}
                        disabled={completing}
                    >
                        {completing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                        )}
                        Complete Session
                    </Button>
                </div>
            </div>

            {/* Progress & Balance Banner */}
            <div className="neu-raised rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Matched: {session.matchedCount} of {totalItems}
                    </span>
                    <span className="text-sm font-bold text-[#FFCC00]">{matchPercent}%</span>
                </div>
                <Progress value={matchPercent} className="h-2 mb-3" />
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                        <p className="text-zinc-500 text-xs mb-1">Statement</p>
                        <p className="font-bold text-zinc-200">{formatCurrency(statementBalance)}</p>
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs mb-1">Ledger</p>
                        <p className="font-bold text-zinc-200">{formatCurrency(ledgerBalance)}</p>
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs mb-1">Difference</p>
                        <p className={cn("font-bold", difference === 0 ? "text-emerald-400" : "text-red-400")}>
                            {formatCurrency(difference)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bank Transactions */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            Bank Transactions
                            <Badge variant="secondary" className="text-[10px] ml-auto">
                                {bankTransactions.length}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {bankTransactions.length === 0 ? (
                            <p className="text-xs text-zinc-500 text-center py-6">No bank transactions for this period</p>
                        ) : (
                            <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-gold">
                                {bankTransactions.map((tx) => {
                                    const StatusIcon = statusIcons[tx.matchStatus] ?? MinusCircle;
                                    return (
                                        <button
                                            key={tx.id}
                                            type="button"
                                            onClick={() => handleSelectBankTx(tx)}
                                            className={cn(
                                                "w-full text-left p-2.5 rounded-lg border transition-all text-xs",
                                                selectedBankTx?.id === tx.id
                                                    ? "border-[#FFCC00]/50 bg-[#FFCC00]/5"
                                                    : "border-white/5 hover:border-white/10"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <StatusIcon className={cn(
                                                        "h-3.5 w-3.5 shrink-0",
                                                        tx.matchStatus === 'confirmed' && "text-emerald-400",
                                                        tx.matchStatus === 'suggested' && "text-amber-400",
                                                        tx.matchStatus === 'rejected' && "text-red-400",
                                                        tx.matchStatus === 'unmatched' && "text-zinc-500",
                                                    )} />
                                                    <div className="min-w-0">
                                                        <p className="text-zinc-300 truncate">{tx.description}</p>
                                                        <p className="text-zinc-600">{tx.date}</p>
                                                    </div>
                                                </div>
                                                <span className={cn(
                                                    "font-bold shrink-0",
                                                    tx.amount >= 0 ? "text-emerald-400" : "text-red-400"
                                                )}>
                                                    {formatCurrency(tx.amount)}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Ledger Entries / Suggestions Panel */}
                <div className="space-y-4">
                    {selectedBankTx ? (
                        <ReconMatchSuggestions
                            transaction={selectedBankTx}
                            suggestions={suggestions}
                            ledgerEntries={ledgerEntries.map(le => ({
                                id: le.id,
                                reference: le.reference,
                                date: le.date,
                                amount: le.amount,
                            }))}
                            sessionId={sessionId}
                            onConfirm={handleConfirmMatch}
                            onReject={handleRejectMatch}
                            onManualMatch={handleManualMatch}
                            onMarkNoMatch={handleMarkNoMatch}
                            onClose={() => {
                                setSelectedBankTx(null);
                                setSuggestions([]);
                            }}
                        />
                    ) : (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                                    Ledger Entries
                                    <Badge variant="secondary" className="text-[10px] ml-auto">
                                        {ledgerEntries.length}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {ledgerEntries.length === 0 ? (
                                    <p className="text-xs text-zinc-500 text-center py-6">No ledger entries for this period</p>
                                ) : (
                                    <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-gold">
                                        {ledgerEntries.map((le) => {
                                            const StatusIcon = statusIcons[le.matchStatus] ?? MinusCircle;
                                            return (
                                                <div
                                                    key={le.id}
                                                    className="p-2.5 rounded-lg border border-white/5 text-xs"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <StatusIcon className={cn(
                                                                "h-3.5 w-3.5 shrink-0",
                                                                le.matchStatus === 'confirmed' && "text-emerald-400",
                                                                le.matchStatus === 'suggested' && "text-amber-400",
                                                                le.matchStatus === 'rejected' && "text-red-400",
                                                                le.matchStatus === 'unmatched' && "text-zinc-500",
                                                            )} />
                                                            <div className="min-w-0">
                                                                <p className="text-zinc-300 truncate">{le.reference}</p>
                                                                <p className="text-zinc-600">{le.date}</p>
                                                            </div>
                                                        </div>
                                                        <span className={cn(
                                                            "font-bold shrink-0",
                                                            le.amount >= 0 ? "text-emerald-400" : "text-red-400"
                                                        )}>
                                                            {formatCurrency(le.amount)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
