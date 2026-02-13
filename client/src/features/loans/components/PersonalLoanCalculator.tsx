import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Banknote, DollarSign, Percent, Clock } from 'lucide-react';
import { loanApi } from '@/api';
import type { PersonalLoanResult } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

export function PersonalLoanCalculator() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PersonalLoanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [principal, setPrincipal] = useState('20000');
  const [rate, setRate] = useState('9.5');
  const [term, setTerm] = useState('60');
  const [establishmentFee, setEstablishmentFee] = useState('250');
  const [monthlyFee, setMonthlyFee] = useState('10');

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loanApi.calculatePersonalLoan({
        principal: Math.round(parseFloat(principal) * 100),
        annualRate: parseFloat(rate) / 100,
        termMonths: parseInt(term),
        establishmentFee: establishmentFee
          ? Math.round(parseFloat(establishmentFee) * 100)
          : undefined,
        monthlyFee: monthlyFee ? Math.round(parseFloat(monthlyFee) * 100) : undefined,
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
      <Card className="neu-raised border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#FFCC00]" />
            Personal Loan Calculator
          </CardTitle>
          <CardDescription>Calculate repayments and comparison rate including fees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Loan Amount ($)</Label>
              <Input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Interest Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Term (months)</Label>
              <Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Establishment Fee ($)</Label>
              <Input
                type="number"
                value={establishmentFee}
                onChange={(e) => setEstablishmentFee(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Fee ($)</Label>
              <Input
                type="number"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleCalculate}
            disabled={loading}
            className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#e6b800]"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Calculate
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

      {result && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="neu-raised border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#FFCC00]" />
                Monthly Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(result.monthlyPayment)}</div>
            </CardContent>
          </Card>
          <Card className="neu-raised border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Total Interest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">
                {formatCurrency(result.totalInterest)}
              </div>
            </CardContent>
          </Card>
          <Card className="neu-raised border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(result.totalCost)}</div>
            </CardContent>
          </Card>
          <Card className="neu-raised border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-400" />
                Comparison Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">
                {formatPercent(result.comparisonRate)}
              </div>
              <p className="text-xs text-zinc-500">True cost including all fees</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
