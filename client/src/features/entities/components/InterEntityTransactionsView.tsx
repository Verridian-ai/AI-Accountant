import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeftRight, Plus, Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { entityApi } from '@/api';
import type { InterEntityTransactionData, EntityWithDetails } from '@/api';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  eliminated: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  disputed: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const TRANSACTION_TYPES = [
  'loan',
  'management_fee',
  'dividend',
  'distribution',
  'rent',
  'service_fee',
  'asset_transfer',
  'capital_contribution',
];

const TYPE_LABELS: Record<string, string> = {
  loan: 'Loan',
  management_fee: 'Management Fee',
  dividend: 'Dividend',
  distribution: 'Distribution',
  rent: 'Rent',
  service_fee: 'Service Fee',
  asset_transfer: 'Asset Transfer',
  capital_contribution: 'Capital Contribution',
};

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

interface InterEntityTransactionsViewProps {
  entities: EntityWithDetails[];
  selectedEntityId: string;
}

export function InterEntityTransactionsView({
  entities,
  selectedEntityId,
}: InterEntityTransactionsViewProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<InterEntityTransactionData[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const entityMap = new Map(entities.map((e) => [e.id, e.name]));

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (selectedEntityId !== 'all') filters.entityId = selectedEntityId;
      if (filterStatus !== 'all') filters.status = filterStatus;
      if (filterType !== 'all') filters.transactionType = filterType;
      const result = await entityApi.getInterEntityTransactions(filters);
      setTransactions(result);
    } catch (err) {
      console.error('Failed to load inter-entity transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId, filterStatus, filterType]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleConfirm = async (id: string, entityId: string, confirmed: boolean) => {
    setConfirming(id);
    try {
      await entityApi.confirmInterEntityTransaction(id, entityId, confirmed);
      toast.success(confirmed ? 'Transaction confirmed' : 'Transaction disputed');
      loadTransactions();
    } catch (err) {
      console.error('Failed to confirm transaction:', err);
      toast.error('Failed to update transaction');
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="eliminated">Eliminated</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TRANSACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          onClick={() => setShowRecordForm(true)}
          className="bg-cba-gold text-base hover:bg-cba-gold/90 font-bold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Record Transaction
        </Button>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <Card className="neu-raised border-0">
          <CardContent className="p-8 text-center">
            <ArrowLeftRight className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
            <h3 className="text-lg font-bold text-primary mb-1">No Inter-Entity Transactions</h3>
            <p className="text-sm text-muted">
              Record transactions between entities to track inter-company flows
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-bold text-muted uppercase tracking-wide">
            <div className="col-span-2">Date</div>
            <div className="col-span-2">From</div>
            <div className="col-span-2">To</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {transactions.map((tx) => (
            <Card key={tx.id} className="neu-raised border-0">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
                  <div className="col-span-2 text-sm text-secondary">
                    {new Date(tx.transactionDate).toLocaleDateString('en-AU')}
                  </div>
                  <div className="col-span-2 text-sm font-medium text-primary truncate">
                    {entityMap.get(tx.fromEntityId) ?? tx.fromEntityId}
                  </div>
                  <div className="col-span-2 text-sm font-medium text-primary truncate">
                    {entityMap.get(tx.toEntityId) ?? tx.toEntityId}
                  </div>
                  <div className="col-span-1">
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[tx.transactionType] ?? tx.transactionType}
                    </Badge>
                    {tx.transactionType === 'loan' && (
                      <Badge
                        variant="outline"
                        className="ml-1 bg-red-500/10 text-red-400 border-red-500/30 text-[10px]"
                      >
                        <AlertTriangle className="w-3 h-3 mr-0.5" />
                        Div 7A
                      </Badge>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-sm font-bold text-cba-gold">
                    {formatMoney(tx.amount)}
                  </div>
                  <div className="col-span-1">
                    <Badge variant="outline" className={STATUS_COLORS[tx.status] ?? ''}>
                      {tx.status}
                    </Badge>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {tx.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 h-7 px-2"
                          disabled={confirming === tx.id}
                          onClick={() => handleConfirm(tx.id, tx.fromEntityId, true)}
                        >
                          {confirming === tx.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 border-red-500/30 hover:bg-red-500/10 h-7 px-2"
                          disabled={confirming === tx.id}
                          onClick={() => handleConfirm(tx.id, tx.fromEntityId, false)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {tx.description && (
                  <p className="text-xs text-muted mt-1 lg:ml-0">{tx.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Record Transaction Modal */}
      {showRecordForm && (
        <RecordTransactionModal
          entities={entities}
          onClose={() => setShowRecordForm(false)}
          onSuccess={() => {
            setShowRecordForm(false);
            loadTransactions();
          }}
        />
      )}
    </div>
  );
}

interface RecordTransactionModalProps {
  entities: EntityWithDetails[];
  onClose: () => void;
  onSuccess: () => void;
}

function RecordTransactionModal({ entities, onClose, onSuccess }: RecordTransactionModalProps) {
  const [saving, setSaving] = useState(false);
  const [fromEntityId, setFromEntityId] = useState('');
  const [toEntityId, setToEntityId] = useState('');
  const [transactionType, setTransactionType] = useState('loan');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromEntityId || !toEntityId || !amount) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (fromEntityId === toEntityId) {
      toast.error('From and To entities must be different');
      return;
    }

    setSaving(true);
    try {
      await entityApi.recordInterEntityTransaction({
        fromEntityId,
        toEntityId,
        transactionType,
        amount: Math.round(parseFloat(amount) * 100),
        description,
        transactionDate,
      });
      toast.success('Inter-entity transaction recorded');
      onSuccess();
    } catch (err) {
      console.error('Failed to record transaction:', err);
      toast.error('Failed to record transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 neu-raised rounded-2xl p-6">
        <Card className="border-0 bg-transparent shadow-none">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-gradient-gold flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5" />
              Record Inter-Entity Transaction
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>From Entity *</Label>
                <Select value={fromEntityId} onValueChange={setFromEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To Entity *</Label>
                <Select value={toEntityId} onValueChange={setToEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t] ?? t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iet-amount">Amount ($) *</Label>
                <Input
                  id="iet-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iet-date">Date *</Label>
                <Input
                  id="iet-date"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iet-desc">Description</Label>
                <Input
                  id="iet-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-cba-gold text-base hover:bg-cba-gold/90 font-bold flex-1"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {saving ? 'Recording...' : 'Record'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
