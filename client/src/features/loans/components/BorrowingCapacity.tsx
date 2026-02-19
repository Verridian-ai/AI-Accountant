import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Loader2, Calculator, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { BASE_URL, getAuthHeaders } from '@/api';

interface DebtEntry {
  id: number;
  name: string;
  balance: string;
  monthlyPayment: string;
}

interface CapacityResult {
  max_borrowing: number;
  serviceability_rate: number;
  monthly_repayment: number;
  dti_ratio: number;
  lti_ratio: number;
  net_monthly_income: number;
  monthly_surplus: number;
  sensitivity: Array<{
    rate_increase: number;
    max_borrowing: number;
    monthly_repayment: number;
  }>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

function dtiColor(ratio: number): string {
  if (ratio < 6) return 'text-emerald-400';
  if (ratio <= 8) return 'text-yellow-400';
  return 'text-red-400';
}

function dtiBadge(ratio: number): { label: string; color: string } {
  if (ratio < 6)
    return { label: 'Healthy', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  if (ratio <= 8)
    return { label: 'Caution', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
  return { label: 'High Risk', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
}

async function fetchBorrowingCapacity(params: Record<string, unknown>): Promise<CapacityResult> {
  const res = await fetch(`${BASE_URL}/api/cdr/loans/borrowing-capacity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to calculate borrowing capacity');
  return res.json();
}

let nextDebtId = 1;

export function BorrowingCapacity() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CapacityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [grossIncome, setGrossIncome] = useState('120000');
  const [otherIncome, setOtherIncome] = useState('0');
  const [debts, setDebts] = useState<DebtEntry[]>([]);
  const [livingExpenses, setLivingExpenses] = useState('3000');
  const [dependents, setDependents] = useState('0');
  const [loanPurpose, setLoanPurpose] = useState('owner_occupied');
  const [loanTerm, setLoanTerm] = useState('30');
  const [sensitivityRange, setSensitivityRange] = useState('3');

  const addDebt = () => {
    setDebts((prev) => [...prev, { id: nextDebtId++, name: '', balance: '', monthlyPayment: '' }]);
  };

  const removeDebt = (id: number) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDebt = (id: number, field: keyof Omit<DebtEntry, 'id'>, value: string) => {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBorrowingCapacity({
        gross_annual_income: Math.round(parseFloat(grossIncome) * 100),
        other_annual_income: Math.round(parseFloat(otherIncome) * 100),
        existing_debts: debts.map((d) => ({
          name: d.name || 'Debt',
          balance: Math.round(parseFloat(d.balance || '0') * 100),
          monthly_payment: Math.round(parseFloat(d.monthlyPayment || '0') * 100),
        })),
        monthly_living_expenses: Math.round(parseFloat(livingExpenses) * 100),
        dependents: parseInt(dependents),
        loan_purpose: loanPurpose,
        loan_term_years: parseInt(loanTerm),
        sensitivity_max_increase: parseFloat(sensitivityRange),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card className="neu-raised border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cba-gold" />
            Borrowing Capacity Estimator
          </CardTitle>
          <CardDescription>
            APRA-compliant estimate using CDR market rates with 3% serviceability buffer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Gross Annual Income ($)</Label>
              <Input
                type="number"
                value={grossIncome}
                onChange={(e) => setGrossIncome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Other Annual Income ($)</Label>
              <Input
                type="number"
                value={otherIncome}
                onChange={(e) => setOtherIncome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Living Expenses ($)</Label>
              <Input
                type="number"
                value={livingExpenses}
                onChange={(e) => setLivingExpenses(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Dependents</Label>
              <Input
                type="number"
                min="0"
                value={dependents}
                onChange={(e) => setDependents(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Loan Purpose</Label>
              <Select value={loanPurpose} onValueChange={setLoanPurpose}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner_occupied">Owner Occupied</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                  <SelectItem value="construction">Construction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loan Term (years)</Label>
              <Select value={loanTerm} onValueChange={setLoanTerm}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 years</SelectItem>
                  <SelectItem value="20">20 years</SelectItem>
                  <SelectItem value="25">25 years</SelectItem>
                  <SelectItem value="30">30 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dynamic Debt List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Existing Debts</Label>
              <Button variant="outline" size="sm" onClick={addDebt} className="text-xs">
                <Plus className="w-3 h-3 mr-1" /> Add Debt
              </Button>
            </div>
            {debts.map((debt) => (
              <div
                key={debt.id}
                className="grid gap-3 md:grid-cols-4 items-end p-3 rounded-lg bg-overlay"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={debt.name}
                    onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                    placeholder="e.g. Car loan"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Balance ($)</Label>
                  <Input
                    type="number"
                    value={debt.balance}
                    onChange={(e) => updateDebt(debt.id, 'balance', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monthly Payment ($)</Label>
                  <Input
                    type="number"
                    value={debt.monthlyPayment}
                    onChange={(e) => updateDebt(debt.id, 'monthlyPayment', e.target.value)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDebt(debt.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {debts.length === 0 && (
              <p className="text-xs text-muted italic">No existing debts added</p>
            )}
          </div>

          {/* Sensitivity Range */}
          <div className="space-y-2">
            <Label>Rate Sensitivity: up to +{sensitivityRange}%</Label>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={sensitivityRange}
              onChange={(e) => setSensitivityRange(e.target.value)}
              className="w-full max-w-xs h-2 bg-overlay-hover rounded-lg appearance-none cursor-pointer accent-[#FFCC00]"
            />
          </div>

          <Button
            onClick={handleCalculate}
            disabled={loading}
            className="bg-cba-gold text-base hover:bg-[#e6b800]"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Calculate Capacity
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500/20">
          <CardContent className="pt-6">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Max Borrowing Hero */}
          <Card className="neu-raised border-cba-gold/20">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-sm text-secondary mb-1">Maximum Borrowing Power</p>
              <p className="text-5xl font-bold text-cba-gold mb-4">
                {formatCurrency(result.max_borrowing / 100)}
              </p>
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-muted">Serviceability Rate</p>
                  <p className="text-lg font-semibold">
                    {(result.serviceability_rate * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Monthly Repayment</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(result.monthly_repayment / 100)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ratios */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="neu-raised border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-secondary">Debt-to-Income (DTI) Ratio</p>
                  <Badge className={dtiBadge(result.dti_ratio).color}>
                    {dtiBadge(result.dti_ratio).label}
                  </Badge>
                </div>
                <p className={`text-3xl font-bold ${dtiColor(result.dti_ratio)}`}>
                  {result.dti_ratio.toFixed(1)}x
                </p>
                <p className="text-xs text-muted mt-1">
                  {result.dti_ratio < 6
                    ? 'Within recommended limits'
                    : result.dti_ratio <= 8
                      ? 'Approaching APRA limits'
                      : 'Exceeds recommended limits'}
                </p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-border/50">
              <CardContent className="pt-6">
                <p className="text-sm text-secondary mb-2">Loan-to-Income (LTI) Ratio</p>
                <p className={`text-3xl font-bold ${dtiColor(result.lti_ratio)}`}>
                  {result.lti_ratio.toFixed(1)}x
                </p>
                <div className="flex justify-between mt-3 text-xs text-muted">
                  <span>Net Monthly Income: {formatCurrency(result.net_monthly_income / 100)}</span>
                  <span>Surplus: {formatCurrency(result.monthly_surplus / 100)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sensitivity Table */}
          {result.sensitivity.length > 0 && (
            <Card className="neu-raised border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Rate Sensitivity Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted uppercase border-b border-border/50">
                        <th className="text-left py-2 pr-3">Rate Increase</th>
                        <th className="text-right py-2 px-2">Max Borrowing</th>
                        <th className="text-right py-2 px-2">Monthly Repayment</th>
                        <th className="text-right py-2 pl-2">Reduction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.sensitivity.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3 text-yellow-400">
                            +{(row.rate_increase * 100).toFixed(1)}%
                          </td>
                          <td className="text-right py-2 px-2">
                            {formatCurrency(row.max_borrowing / 100)}
                          </td>
                          <td className="text-right py-2 px-2">
                            {formatCurrency(row.monthly_repayment / 100)}
                          </td>
                          <td className="text-right py-2 pl-2 text-red-400">
                            -{formatCurrency((result.max_borrowing - row.max_borrowing) / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* APRA Disclaimer */}
          <div className="p-4 rounded-lg bg-overlay border border-border">
            <p className="text-xs text-muted leading-relaxed">
              <strong className="text-secondary">Disclaimer:</strong> This is an estimate only and
              does not constitute a loan offer or pre-approval. Actual borrowing capacity depends on
              individual lender criteria, credit history, and APRA regulatory requirements. A 3%
              serviceability buffer rate is applied per APRA guidelines. Consult a licensed mortgage
              broker or financial adviser for personalised advice.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
