import { useState, useEffect } from 'react';
import { api, type Account } from '@/api';
import { cn } from '@/lib/utils';
import { ChevronDown, Wallet, CreditCard, PiggyBank, Building2, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ACCOUNT_TYPE_ICONS: Record<string, React.ElementType> = {
  checking: Wallet,
  savings: PiggyBank,
  credit_card: CreditCard,
  loan: Building2,
  transaction: Wallet,
  credit: CreditCard,
  other: Wallet,
};

interface AccountSwitcherProps {
  selectedAccountId: string | null;
  onAccountChange: (accountId: string | null) => void;
  className?: string;
}

export function AccountSwitcher({ selectedAccountId, onAccountChange, className }: AccountSwitcherProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    api.fetchAccounts()
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const Icon = selectedAccount ? (ACCOUNT_TYPE_ICONS[selectedAccount.accountType] || Wallet) : Filter;

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return '—';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(cents / 100);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl neu-raised border transition-all w-full sm:w-auto",
          selectedAccountId ? "border-[#FFCC00]/20" : "border-white/5",
          "hover:border-[#FFCC00]/30"
        )}
      >
        <Icon className="w-4 h-4 text-[#FFCC00]" />
        <span className="text-xs font-black text-zinc-200 uppercase tracking-tight truncate max-w-[160px]">
          {loading ? 'Loading...' : selectedAccount?.accountName || 'All Accounts'}
        </span>
        {selectedAccount && (
          <Badge variant="secondary" className="text-[8px] hidden sm:inline-flex">
            {formatCurrency(selectedAccount.currentBalance)}
          </Badge>
        )}
        <ChevronDown className={cn("w-3 h-3 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 z-50 w-72 neu-raised rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
            {/* All Accounts option */}
            <button
              type="button"
              onClick={() => { onAccountChange(null); setIsOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 transition-all border-b border-white/5",
                !selectedAccountId ? "bg-[#FFCC00]/5 text-[#FFCC00]" : "text-zinc-300 hover:bg-white/5"
              )}
            >
              <Filter className="w-4 h-4" />
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-tight">All Accounts</p>
                <p className="text-[8px] font-bold text-zinc-600 uppercase">Unified view</p>
              </div>
            </button>

            {/* Account list */}
            <div className="max-h-64 overflow-y-auto">
              {accounts.map(account => {
                const AccIcon = ACCOUNT_TYPE_ICONS[account.accountType] || Wallet;
                const isSelected = selectedAccountId === account.id;
                const isNegative = account.currentBalance !== null && account.currentBalance < 0;
                const ownershipTag = account.ownershipTag;

                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => { onAccountChange(account.id); setIsOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 transition-all border-b border-white/5 last:border-0",
                      isSelected ? "bg-[#FFCC00]/5" : "hover:bg-white/5"
                    )}
                  >
                    <div className={cn("neu-inset p-2 rounded-lg", isSelected ? "text-[#FFCC00]" : "text-zinc-500")}>
                      <AccIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-xs font-black uppercase tracking-tight truncate", isSelected ? "text-[#FFCC00]" : "text-zinc-200")}>
                          {account.accountName}
                        </p>
                        {ownershipTag && (
                          <Badge variant={ownershipTag === 'personal' ? 'outline' : 'secondary'} className="text-[7px] shrink-0">
                            {ownershipTag}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                        {account.bankName || account.accountType.replace('_', ' ')}
                      </p>
                    </div>
                    <p className={cn(
                      "text-xs font-black tracking-tighter shrink-0",
                      isNegative ? "text-red-400" : "text-emerald-400"
                    )}>
                      {formatCurrency(account.currentBalance)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
