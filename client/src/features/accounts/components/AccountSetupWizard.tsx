import { useState } from 'react';
import { api } from '@/api';
import { X, CreditCard, Wallet, PiggyBank, Building2, TrendingDown, HelpCircle, Loader2, CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountSetupWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (accountId: string) => void;
    detectedInfo: {
        accountNumber: string | null;
        accountNumberMasked: string | null;
        bankName: string | null;
        accountType: string | null;
        openingBalance: number | null;
        closingBalance: number | null;
    };
    statementId: string;
}

const ACCOUNT_TYPES = [
    { id: 'checking', label: 'Checking Account', icon: Wallet, description: 'Everyday transaction account' },
    { id: 'savings', label: 'Savings Account', icon: PiggyBank, description: 'Interest-earning savings' },
    { id: 'credit_card', label: 'Credit Card', icon: CreditCard, description: 'Credit card account' },
    { id: 'loan', label: 'Loan', icon: TrendingDown, description: 'Personal or home loan' },
    { id: 'investment', label: 'Investment', icon: Building2, description: 'Investment or brokerage' },
    { id: 'unknown', label: 'Other', icon: HelpCircle, description: 'Other account type' },
];

export function AccountSetupWizard({ isOpen, onClose, onComplete, detectedInfo, statementId: _statementId }: AccountSetupWizardProps) {
    void _statementId; // Reserved for future use
    const [accountName, setAccountName] = useState('');
    const [accountType, setAccountType] = useState(detectedInfo.accountType || 'checking');
    const [interestRate, setInterestRate] = useState<string>('');
    const [creditLimit, setCreditLimit] = useState<string>('');
    const [minimumPayment, setMinimumPayment] = useState<string>('');
    const [paymentDueDay] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!accountName.trim()) {
            setError('Please enter an account name');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const result = await api.createAccount({
                accountNumber: detectedInfo.accountNumber || detectedInfo.accountNumberMasked || 'UNKNOWN',
                accountName: accountName.trim(),
                accountType,
                bankName: detectedInfo.bankName || undefined,
                interestRate: interestRate ? parseFloat(interestRate) : undefined,
                creditLimit: creditLimit ? Math.round(parseFloat(creditLimit) * 100) : undefined,
                minimumPayment: minimumPayment ? Math.round(parseFloat(minimumPayment) * 100) : undefined,
                paymentDueDay: paymentDueDay ? parseInt(paymentDueDay) : undefined,
            });
            onComplete(result.id);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create account');
        } finally {
            setSaving(false);
        }
    };

    const isCreditOrLoan = accountType === 'credit_card' || accountType === 'loan';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FFCC00]/5 rounded-full blur-[160px]" />
            </div>

            <div className="neu-raised rounded-[2.5rem] w-full max-w-xl overflow-hidden relative border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 neu-inset rounded-2xl text-[#FFCC00]">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gradient-gold tracking-tight uppercase">Vault Initialization</h2>
                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-[#FFCC00]" /> New Data Node Detected
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="neu-raised-sm p-2 rounded-xl text-zinc-500 hover:text-red-400 btn-press"
                        aria-label="Close wizard"
                        title="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-thin">
                    {/* Detected Info */}
                    <div className="neu-inset rounded-2xl p-5 border border-[#FFCC00]/10 space-y-3 bg-[#FFCC00]/[0.02]">
                        <p className="text-[10px] font-black text-[#FFCC00] uppercase tracking-[0.2em]">Telemetry Detection</p>
                        <div className="grid grid-cols-2 gap-4">
                            {detectedInfo.bankName && (
                                <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block">Source Institution</span>
                                    <span className="text-sm font-black text-zinc-300">{detectedInfo.bankName}</span>
                                </div>
                            )}
                            {detectedInfo.accountNumberMasked && (
                                <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block">Node Identifier</span>
                                    <span className="text-sm font-black text-[#FFCC00] font-mono tracking-tighter">{detectedInfo.accountNumberMasked}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Account Name */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1">Vault Alias</label>
                        <input
                            type="text"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            placeholder="e.g., PRIMARY_ACCESS_01"
                            className="w-full px-5 py-4 neu-inset rounded-2xl focus-gold outline-none text-[#FFCC00] font-black text-sm placeholder-zinc-800 transition-all bg-transparent"
                        />
                    </div>

                    {/* Account Type */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1">Node Classification</label>
                        <div className="grid grid-cols-2 gap-3">
                            {ACCOUNT_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isSelected = accountType === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => setAccountType(type.id)}
                                        className={cn(
                                            "flex items-center gap-3 p-4 rounded-2xl border transition-all btn-press",
                                            isSelected
                                                ? "cba-gold-gradient text-[#0a0a0f] border-transparent shadow-lg cba-gold-glow"
                                                : "neu-raised-sm border-white/5 text-zinc-500 hover:text-zinc-300"
                                        )}
                                    >
                                        <Icon className={cn("w-5 h-5", isSelected ? "text-[#0a0a0f]" : "text-zinc-600")} />
                                        <span className="font-black uppercase tracking-tight text-[11px]">{type.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Credit/Loan specific fields */}
                    {isCreditOrLoan && (
                        <div className="grid grid-cols-2 gap-6 p-6 neu-inset rounded-3xl border border-white/5 bg-black/20 animate-in slide-in-from-top-4 duration-500">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Interest Rate (%)</label>
                                <input type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)}
                                    placeholder="0.00" className="w-full px-4 py-3 neu-inset rounded-xl text-sm font-black text-[#FFCC00] outline-none" />
                            </div>
                            {accountType === 'credit_card' && (<>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Credit Limit ($)</label>
                                    <input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)}
                                        placeholder="0" className="w-full px-4 py-3 neu-inset rounded-xl text-sm font-black text-[#FFCC00] outline-none" />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Minimum Obligation ($)</label>
                                    <input type="number" value={minimumPayment} onChange={(e) => setMinimumPayment(e.target.value)}
                                        placeholder="0" className="w-full px-4 py-3 neu-inset rounded-xl text-sm font-black text-[#FFCC00] outline-none" />
                                </div>
                            </>)}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-pulse">
                            Error: {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-white/[0.01] border-t border-white/5 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-4 rounded-xl text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em] neu-raised-sm btn-press"
                    >
                        Decline Setup
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !accountName.trim()}
                        className="px-8 py-4 cba-gold-gradient text-[#0a0a0f] font-black text-[10px] uppercase tracking-[0.2em] rounded-xl btn-press disabled:opacity-30 disabled:grayscale shadow-lg cba-gold-glow flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Transmitting...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                Authorize Node
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}