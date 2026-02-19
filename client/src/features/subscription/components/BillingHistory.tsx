import { useState, useEffect } from 'react';
import { Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantApi } from '@/api';

interface BillingRecord {
  id: string;
  planName: string;
  status: string;
  billingCycle: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  cancelled: { bg: 'bg-red-500/10', text: 'text-red-400' },
  trialing: { bg: 'bg-cba-gold/10', text: 'text-cba-gold' },
  expired: { bg: 'bg-zinc-500/10', text: 'text-secondary' },
  past_due: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
};

export function BillingHistory() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantId = localStorage.getItem('tenantId');

  useEffect(() => {
    if (!tenantId) return;
    tenantApi
      .getBillingHistory(tenantId)
      .then((data: BillingRecord[]) => setRecords(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantId]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Billing History</h2>
        <div className="neu-raised rounded-2xl p-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Billing History</h2>
        <p className="text-sm text-muted">View your subscription payments and invoices</p>
      </div>

      <div className="neu-raised rounded-2xl border border-border/50 overflow-hidden">
        {records.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-muted">No billing records yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">
                    Plan
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest hidden md:table-cell">
                    Cycle
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest hidden lg:table-cell">
                    Period
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const style = STATUS_STYLES[rec.status] ?? STATUS_STYLES.expired;
                  return (
                    <tr
                      key={rec.id}
                      className="border-b border-border/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-primary">{rec.planName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-xs font-bold px-2 py-1 rounded-lg uppercase tracking-wider',
                            style.bg,
                            style.text,
                          )}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-secondary hidden md:table-cell capitalize">
                        {rec.billingCycle}
                      </td>
                      <td className="px-4 py-3 text-secondary hidden lg:table-cell">
                        {formatDate(rec.periodStart)} — {formatDate(rec.periodEnd)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary tabular-nums">
                        {formatCurrency(rec.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
