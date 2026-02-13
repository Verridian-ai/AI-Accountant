import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { assetApi } from '@/api';
import type { FixedAssetData } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const DISPOSAL_METHODS = [
  { value: 'sale', label: 'Sale' },
  { value: 'scrapped', label: 'Scrapped' },
  { value: 'trade_in', label: 'Trade-In' },
  { value: 'theft', label: 'Theft / Loss' },
  { value: 'insurance_claim', label: 'Insurance Claim' },
];

interface AssetDisposalFormProps {
  assets: FixedAssetData[];
  onSuccess: () => void;
}

export function AssetDisposalForm({ assets, onSuccess }: AssetDisposalFormProps) {
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [disposalDate, setDisposalDate] = useState('');
  const [disposalMethod, setDisposalMethod] = useState('');
  const [proceeds, setProceeds] = useState('');
  const [buyerDetails, setBuyerDetails] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAssets = useMemo(() => assets.filter((a) => a.status === 'active'), [assets]);
  const selectedAsset = useMemo(
    () => activeAssets.find((a) => a.id === selectedAssetId),
    [activeAssets, selectedAssetId],
  );

  const proceedsCents = Math.round((parseFloat(proceeds) || 0) * 100);
  const wdvAtDisposal = selectedAsset?.currentWrittenDownValue ?? 0;
  const gainLoss = proceedsCents - wdvAtDisposal;
  const isCgtApplicable = gainLoss > 0 && selectedAsset && selectedAsset.purchasePrice >= 1000000;

  const handleSubmit = async () => {
    if (!selectedAssetId || !disposalDate || !disposalMethod) return;
    setSubmitting(true);
    setError(null);
    try {
      await assetApi.disposeAsset(selectedAssetId, {
        disposalDate,
        disposalMethod,
        proceedsCents,
        buyerDetails: buyerDetails || undefined,
        invoiceReference: invoiceRef || undefined,
        notes: notes || undefined,
      });
      setSelectedAssetId('');
      setDisposalDate('');
      setDisposalMethod('');
      setProceeds('');
      setBuyerDetails('');
      setInvoiceRef('');
      setNotes('');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispose asset');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="neu-raised border-white/5">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-zinc-100 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-400" />
          Record Asset Disposal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {activeAssets.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No active assets available for disposal</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Select Asset</Label>
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose asset to dispose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAssets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.assetNumber} — {a.assetName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Disposal Date</Label>
                <Input
                  type="date"
                  value={disposalDate}
                  onChange={(e) => setDisposalDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Disposal Method</Label>
                <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPOSAL_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Disposal Proceeds ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={proceeds}
                  onChange={(e) => setProceeds(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Buyer Details</Label>
                <Input
                  placeholder="Optional"
                  value={buyerDetails}
                  onChange={(e) => setBuyerDetails(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Reference</Label>
                <Input
                  placeholder="Optional"
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {selectedAsset && (
              <div className="neu-inset rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-zinc-300">Disposal Summary</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500 text-xs">Purchase Price</p>
                    <p className="font-mono text-zinc-200">
                      {formatCurrency(selectedAsset.purchasePrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">WDV at Disposal</p>
                    <p className="font-mono text-[#FFCC00]">{formatCurrency(wdvAtDisposal)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Proceeds</p>
                    <p className="font-mono text-zinc-200">{formatCurrency(proceedsCents)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">
                      {gainLoss >= 0 ? 'Profit' : 'Loss'} on Disposal
                    </p>
                    <p
                      className={`font-mono font-bold ${gainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {gainLoss >= 0 ? '+' : ''}
                      {formatCurrency(gainLoss)}
                    </p>
                  </div>
                </div>
                {isCgtApplicable && (
                  <div className="flex items-center gap-2 mt-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-amber-400">
                      CGT may apply — original cost exceeds $10,000
                    </span>
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedAssetId || !disposalDate || !disposalMethod}
              className="bg-red-500/80 hover:bg-red-500 text-white font-bold"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Disposal
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
