import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BASPeriodSelector } from './BASPeriodSelector';
import { formatCurrency } from '@/lib/format';
import { Loader2, ChevronRight, AlertTriangle, Save, CheckCircle, FileText } from 'lucide-react';
import { gstApi, basApi } from '@/api';
import type { BASCalculationEnhanced } from '@/features/gst/types';

type BASStatus = 'draft' | 'review' | 'ready' | 'lodged' | 'amended';

const getCurrentFinancialYear = () => {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
};

const getCurrentQuarter = (): number => {
  const month = new Date().getMonth();
  if (month >= 6 && month <= 8) return 1;
  if (month >= 9 && month <= 11) return 2;
  if (month >= 0 && month <= 2) return 3;
  return 4;
};

export function BASPreFillReport() {
  const [loading, setLoading] = useState(false);
  const [basData, setBASData] = useState<BASCalculationEnhanced | null>(null);
  const [selectedYear, setSelectedYear] = useState(getCurrentFinancialYear());
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'annual'>('quarterly');
  const [basMethod, setBASMethod] = useState<'simpler' | 'full'>('simpler');
  const [status, setStatus] = useState<BASStatus>('draft');
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const quarterKey = `${selectedYear}-Q${selectedQuarter}`;

  useEffect(() => {
    loadAvailableYears();
  }, []);

  useEffect(() => {
    loadBAS();
  }, [quarterKey, basMethod]);

  const loadAvailableYears = async () => {
    try {
      const quarters = await basApi.fetchQuarters();
      const yearSet = new Set<number>();
      for (const q of quarters) {
        yearSet.add(parseInt(q.financialYear.split('-')[0], 10));
      }
      // Always include current FY
      yearSet.add(getCurrentFinancialYear());
      const sorted = Array.from(yearSet).sort((a, b) => b - a);
      setAvailableYears(sorted);
    } catch {
      // Fallback: just current year
      setAvailableYears([getCurrentFinancialYear()]);
    }
  };

  const loadBAS = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gstApi.fetchBASCalculation(quarterKey, basMethod);
      setBASData(data);
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load BAS data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const s = newStatus as BASStatus;
    setStatus(s);
    try {
      await gstApi.updateBASStatus(quarterKey, s);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleSaveDraft = async () => {
    if (!basData) return;
    try {
      await gstApi.saveBASdraft(quarterKey, basData);
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  };

  const LabelRow = ({
    label,
    description,
    amount,
    count,
  }: {
    label: string;
    description: string;
    amount: number;
    count?: number;
  }) => (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.02] cursor-pointer group transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-[#FFCC00] w-8">{label}</span>
        <span className="text-sm text-zinc-300">{description}</span>
        {count !== undefined && <span className="text-[10px] text-zinc-600">({count} txns)</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{formatCurrency(amount)}</span>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <BASPeriodSelector
        selectedYear={selectedYear}
        selectedQuarter={selectedQuarter}
        periodType={periodType}
        onYearChange={setSelectedYear}
        onQuarterChange={setSelectedQuarter}
        onPeriodTypeChange={setPeriodType}
        availableYears={availableYears.length > 0 ? availableYears : undefined}
      />

      {/* BAS Method & Status */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={basMethod} onValueChange={(v) => setBASMethod(v as 'simpler' | 'full')}>
          <TabsList>
            <TabsTrigger value="simpler">Simpler BAS</TabsTrigger>
            <TabsTrigger value="full">Full BAS</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Status:</span>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[130px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="lodged">Lodged</SelectItem>
              <SelectItem value="amended">Amended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/20 bg-red-500/5 rounded-xl">
          <CardContent className="p-4 text-sm text-red-400">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="neu-raised rounded-xl">
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
            <span className="ml-2 text-zinc-400">Calculating BAS...</span>
          </CardContent>
        </Card>
      ) : (
        basData && (
          <>
            {/* Warnings */}
            {basData.warnings.length > 0 && (
              <div className="space-y-1">
                {basData.warnings.map((warning, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 px-3 py-2 rounded-lg border border-amber-500/10"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {/* Sales Section */}
            <Card className="neu-raised rounded-xl border-l-2 border-l-[#FFCC00]/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                <LabelRow
                  label="G1"
                  description="Total Sales"
                  amount={basData.labels.G1}
                  count={basData.transactionCounts?.G1}
                />
                {basMethod === 'full' && (
                  <>
                    {basData.labels.G2 !== undefined && (
                      <LabelRow label="G2" description="Export Sales" amount={basData.labels.G2} />
                    )}
                    {basData.labels.G3 !== undefined && (
                      <LabelRow
                        label="G3"
                        description="GST-Free Sales"
                        amount={basData.labels.G3}
                      />
                    )}
                    {basData.labels.G4 !== undefined && (
                      <LabelRow
                        label="G4"
                        description="Input Taxed Sales"
                        amount={basData.labels.G4}
                      />
                    )}
                  </>
                )}
                <div className="border-t border-white/5 mt-2 pt-1">
                  <LabelRow label="1A" description="GST on Sales" amount={basData.labels['1A']} />
                </div>
              </CardContent>
            </Card>

            {/* Purchases Section */}
            <Card className="neu-raised rounded-xl border-l-2 border-l-blue-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Purchases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {basMethod === 'full' && (
                  <>
                    {basData.labels.G10 !== undefined && (
                      <LabelRow
                        label="G10"
                        description="Capital Purchases"
                        amount={basData.labels.G10}
                      />
                    )}
                    {basData.labels.G11 !== undefined && (
                      <LabelRow
                        label="G11"
                        description="Non-Capital Purchases"
                        amount={basData.labels.G11}
                      />
                    )}
                  </>
                )}
                <div className={basMethod === 'full' ? 'border-t border-white/5 mt-2 pt-1' : ''}>
                  <LabelRow
                    label="1B"
                    description="GST on Purchases"
                    amount={basData.labels['1B']}
                  />
                </div>
              </CardContent>
            </Card>

            {/* PAYG Section */}
            {(basData.labels.W1 !== undefined || basData.labels.W2 !== undefined) && (
              <Card className="neu-raised rounded-xl border-l-2 border-l-purple-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">PAYG Withholding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5">
                  {basData.labels.W1 !== undefined && (
                    <LabelRow label="W1" description="Gross Wages" amount={basData.labels.W1} />
                  )}
                  {basData.labels.W2 !== undefined && (
                    <LabelRow
                      label="W2"
                      description="Amounts Withheld"
                      amount={basData.labels.W2}
                    />
                  )}
                  {basData.labels['5A'] !== undefined && (
                    <LabelRow
                      label="5A"
                      description="PAYG Instalment"
                      amount={basData.labels['5A']}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <Card className="neu-raised rounded-xl border-[#FFCC00]/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Net GST (1A - 1B)</span>
                    <span className="font-medium">{formatCurrency(basData.netGST)}</span>
                  </div>
                  {basData.labels.W2 !== undefined && basData.labels.W2 > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">PAYG Withheld</span>
                      <span className="font-medium">{formatCurrency(basData.labels.W2)}</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-2 flex justify-between text-base font-bold">
                    <span>{basData.totalPayable > 0 ? 'Total Payable' : 'Total Refundable'}</span>
                    <span
                      className={basData.totalPayable > 0 ? 'text-red-400' : 'text-emerald-400'}
                    >
                      {formatCurrency(Math.abs(basData.totalPayable))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Due Date</span>
                    <span>{basData.dueDate}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-1" />
                Review Transactions
              </Button>
              <Button variant="outline" size="sm" onClick={handleSaveDraft}>
                <Save className="w-4 h-4 mr-1" />
                Save Draft
              </Button>
              <Button size="sm" onClick={() => handleStatusChange('ready')}>
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark Ready
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );
}
