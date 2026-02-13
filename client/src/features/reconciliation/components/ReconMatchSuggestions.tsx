import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Link2, Ban, Loader2 } from 'lucide-react';
import { reconApi } from '@/api';
import { cn } from '@/lib/utils';

export interface BankTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    matchStatus: 'confirmed' | 'suggested' | 'rejected' | 'unmatched';
}

export interface MatchSuggestion {
    matchId: string;
    ledgerEntryId: string;
    ledgerReference: string;
    ledgerDate: string;
    ledgerAmount: number;
    confidence: number;
    reasons: string[];
}

interface LedgerEntry {
    id: string;
    reference: string;
    date: string;
    amount: number;
}

interface ReconMatchSuggestionsProps {
    transaction: BankTransaction | null;
    suggestions: MatchSuggestion[];
    ledgerEntries: LedgerEntry[];
    sessionId: string;
    onConfirm: (matchId: string) => void;
    onReject: (matchId: string) => void;
    onManualMatch: (bankTxId: string, ledgerEntryId: string) => void;
    onMarkNoMatch: (bankTxId: string) => void;
    onClose: () => void;
}

const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function ReconMatchSuggestions({
    transaction,
    suggestions,
    ledgerEntries,
    sessionId,
    onConfirm,
    onReject,
    onManualMatch,
    onMarkNoMatch,
    onClose,
}: ReconMatchSuggestionsProps) {
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showManualMatch, setShowManualMatch] = useState(false);
    const [selectedManualEntry, setSelectedManualEntry] = useState<string | null>(null);

    if (!transaction) return null;

    const handleConfirm = async (matchId: string) => {
        setActionLoading(matchId);
        try {
            await reconApi.confirmMatch(matchId);
            onConfirm(matchId);
        } catch (err) {
            console.error('Failed to confirm match:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (matchId: string) => {
        setActionLoading(`reject-${matchId}`);
        try {
            onReject(matchId);
        } finally {
            setActionLoading(null);
        }
    };

    const handleManualMatch = async () => {
        if (!selectedManualEntry) return;
        setActionLoading('manual');
        try {
            await reconApi.createManualMatch({
                sessionId,
                bankTransactionId: transaction.id,
                ledgerEntryId: selectedManualEntry,
            });
            onManualMatch(transaction.id, selectedManualEntry);
            setShowManualMatch(false);
            setSelectedManualEntry(null);
        } catch (err) {
            console.error('Failed to create manual match:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.9) return 'bg-emerald-500';
        if (confidence >= 0.7) return 'bg-[#FFCC00]';
        if (confidence >= 0.5) return 'bg-amber-500';
        return 'bg-red-500';
    };

    return (
        <Card className="border-[#FFCC00]/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Match Suggestions</CardTitle>
                    <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-500 h-7 px-2">
                        Close
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Selected bank transaction */}
                <div className="neu-inset rounded-xl p-3">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Bank Transaction</p>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-zinc-200">{transaction.description}</p>
                            <p className="text-xs text-zinc-500">{transaction.date}</p>
                        </div>
                        <p className={cn("text-sm font-bold", transaction.amount >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {formatCurrency(transaction.amount)}
                        </p>
                    </div>
                </div>

                {/* Suggestions list */}
                {suggestions.length > 0 ? (
                    <div className="space-y-2">
                        {suggestions
                            .sort((a, b) => b.confidence - a.confidence)
                            .map((suggestion) => (
                                <div
                                    key={suggestion.matchId}
                                    className="neu-raised rounded-xl p-3 border border-white/5 hover:border-[#FFCC00]/20 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-200 truncate">
                                                {suggestion.ledgerReference}
                                            </p>
                                            <p className="text-xs text-zinc-500">{suggestion.ledgerDate}</p>
                                        </div>
                                        <p className={cn(
                                            "text-sm font-bold shrink-0",
                                            suggestion.ledgerAmount >= 0 ? "text-emerald-400" : "text-red-400"
                                        )}>
                                            {formatCurrency(suggestion.ledgerAmount)}
                                        </p>
                                    </div>

                                    {/* Confidence bar */}
                                    <div className="mb-2">
                                        <div className="flex items-center justify-between text-[10px] mb-1">
                                            <span className="text-zinc-500 font-bold uppercase tracking-wider">Confidence</span>
                                            <span className="text-zinc-300 font-bold">{Math.round(suggestion.confidence * 100)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all", getConfidenceColor(suggestion.confidence))}
                                                style={{ width: `${suggestion.confidence * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Reasons */}
                                    {suggestion.reasons.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {suggestion.reasons.map((reason, i) => (
                                                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    {reason}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                                            onClick={() => handleConfirm(suggestion.matchId)}
                                            disabled={actionLoading !== null}
                                        >
                                            {actionLoading === suggestion.matchId ? (
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            ) : (
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                            )}
                                            Confirm
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                            onClick={() => handleReject(suggestion.matchId)}
                                            disabled={actionLoading !== null}
                                        >
                                            {actionLoading === `reject-${suggestion.matchId}` ? (
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            ) : (
                                                <XCircle className="h-3 w-3 mr-1" />
                                            )}
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            ))}
                    </div>
                ) : (
                    <p className="text-sm text-zinc-500 text-center py-4">No automatic suggestions found</p>
                )}

                {/* Manual match / No match actions */}
                <div className="border-t border-white/5 pt-3 space-y-2">
                    {!showManualMatch ? (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-8 text-xs"
                                onClick={() => setShowManualMatch(true)}
                            >
                                <Link2 className="h-3 w-3 mr-1" />
                                Manual Match
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-8 text-xs border-zinc-700 text-zinc-400"
                                onClick={() => onMarkNoMatch(transaction.id)}
                            >
                                <Ban className="h-3 w-3 mr-1" />
                                No Match
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                Select a ledger entry to match
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-gold">
                                {ledgerEntries.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => setSelectedManualEntry(entry.id)}
                                        className={cn(
                                            "w-full text-left p-2 rounded-lg border transition-colors text-xs",
                                            selectedManualEntry === entry.id
                                                ? "border-[#FFCC00]/50 bg-[#FFCC00]/5"
                                                : "border-white/5 hover:border-white/10"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="font-medium text-zinc-300">{entry.reference}</span>
                                                <span className="text-zinc-500 ml-2">{entry.date}</span>
                                            </div>
                                            <span className={cn("font-bold", entry.amount >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                {formatCurrency(entry.amount)}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="flex-1 h-7 text-xs bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90"
                                    onClick={handleManualMatch}
                                    disabled={!selectedManualEntry || actionLoading === 'manual'}
                                >
                                    {actionLoading === 'manual' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                    Link Match
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                        setShowManualMatch(false);
                                        setSelectedManualEntry(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
