import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import { analyticsApi } from '@/api';
import type { RecurringBill } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function BillAlerts() {
  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    analyticsApi
      .fetchBillAlerts()
      .then(setBills)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
        <span className="ml-2 text-zinc-400">Detecting recurring bills...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/20">
        <CardContent className="pt-6">
          <p className="text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const overdue = bills.filter((b) => b.status === 'overdue');
  const amountChanged = bills.filter((b) => b.status === 'amount_changed');
  const current = bills.filter((b) => b.status === 'current');

  const statusIcon = (status: RecurringBill['status']) => {
    switch (status) {
      case 'overdue':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'amount_changed':
        return <TrendingUp className="w-4 h-4 text-amber-400" />;
      case 'current':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    }
  };

  const statusColor = (status: RecurringBill['status']) => {
    switch (status) {
      case 'overdue':
        return 'border-red-500/20 bg-red-500/5';
      case 'amount_changed':
        return 'border-amber-500/20 bg-amber-500/5';
      case 'current':
        return 'border-white/5';
    }
  };

  const renderBill = (bill: RecurringBill) => (
    <div
      key={bill.merchant}
      className={`flex items-center justify-between p-4 rounded-lg border ${statusColor(bill.status)}`}
    >
      <div className="flex items-center gap-3">
        {statusIcon(bill.status)}
        <div>
          <p className="font-medium text-sm">{bill.merchant}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {bill.frequency}
            </Badge>
            <span className="text-xs text-zinc-500">
              <Clock className="w-3 h-3 inline mr-1" />
              Next: {new Date(bill.nextDueDate).toLocaleDateString('en-AU')}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium">{formatCurrency(bill.lastAmount)}</p>
        {bill.status === 'amount_changed' && bill.amountChangePercent !== undefined && (
          <p
            className={`text-xs ${bill.amountChangePercent > 0 ? 'text-red-400' : 'text-emerald-400'}`}
          >
            {bill.amountChangePercent > 0 ? '+' : ''}
            {bill.amountChangePercent.toFixed(1)}% change
          </p>
        )}
        <p className="text-xs text-zinc-500">{bill.occurrenceCount} payments</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Overdue */}
      {overdue.length > 0 && (
        <Card className="neu-raised border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              Overdue ({overdue.length})
            </CardTitle>
            <CardDescription>
              Bills that appear to be past their expected payment date
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">{overdue.map(renderBill)}</CardContent>
        </Card>
      )}

      {/* Amount Changes */}
      {amountChanged.length > 0 && (
        <Card className="neu-raised border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <TrendingUp className="w-5 h-5" />
              Amount Changes ({amountChanged.length})
            </CardTitle>
            <CardDescription>
              Bills where the amount has changed compared to the average
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">{amountChanged.map(renderBill)}</CardContent>
        </Card>
      )}

      {/* Current */}
      <Card className="neu-raised border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Upcoming ({current.length})
          </CardTitle>
          <CardDescription>Recurring bills detected from transaction patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {current.length === 0 ? (
            <p className="text-zinc-500 text-center py-4">No recurring bills detected yet</p>
          ) : (
            current.map(renderBill)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
