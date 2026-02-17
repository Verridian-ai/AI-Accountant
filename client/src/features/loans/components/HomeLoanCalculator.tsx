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
import { Loader2, Home, TrendingDown, Clock, DollarSign } from 'lucide-react';
import { loanApi } from '@/api';
import type { HomeLoanResult, RepaymentFrequency } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function HomeLoanCalculator() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HomeLoanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [principal, setPrincipal] = useState('500000');
  const [rate, setRate] = useState('6.25');
  const [term, setTerm] = useState('30');
  const [frequency, setFrequency] = useState<RepaymentFrequency>('monthly');
  const [offsetBalance, setOffsetBalance] = useState('');
  const [extraRepayment, setExtraRepayment] = useState('');

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        principal: Math.round(parseFloat(principal) * 100),
        annualRate: parseFloat(rate) / 100,
        termMonths: parseInt(term) * 12,
        frequency,
        offsetBalance: offsetBalance ? Math.round(parseFloat(offsetBalance) * 100) : undefined,
        extraRepayment: extraRepayment ? Math.round(parseFloat(extraRepayment) * 100) : undefined,
      };
      const data = await loanApi.calculateHomeLoan(params);
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
      <Card className="neu-raised border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#FFCC00]" />
            Home Loan Calculator
          </CardTitle>
          <CardDescription>Australian home loan with offset and extra repayments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Loan Amount ($)</Label>
              <Input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div className="space-y-2">
              <Label>Interest Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="6.25"
              />
            </div>
            <div className="space-y-2">
              <Label>Term (years)</Label>
              <Input
                type="number"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Repayment Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as RepaymentFrequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Offset Balance ($)</Label>
              <Input
                type="number"
                value={offsetBalance}
                onChange={(e) => setOffsetBalance(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Extra Repayment ($/{frequency})</Label>
              <Input
                type="number"
                value={extraRepayment}
                onChange={(e) => setExtraRepayment(e.target.value)}
                placeholder="0"
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

      {/* Results */}
      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="neu-raised border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#FFCC00]" />
                  {result.frequency.charAt(0).toUpperCase() + result.frequency.slice(1)} Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(result.regularPayment)}</div>
              </CardContent>
            </Card>
            <Card className="neu-raised border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
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
                <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Time to Pay Off
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{result.periodsToPayOff} periods</div>
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
          </div>

          {(result.timeSavedMonths > 0 || result.interestSaved > 0) && (
            <Card className="neu-raised border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 flex-wrap">
                  {result.timeSavedMonths > 0 && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-sm py-1 px-3">
                      {result.timeSavedMonths} months saved
                    </Badge>
                  )}
                  {result.interestSaved > 0 && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-sm py-1 px-3">
                      {formatCurrency(result.interestSaved)} interest saved
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Amortization Preview */}
          {result.schedule.length > 0 && (
            <Card className="neu-raised border-white/5">
              <CardHeader>
                <CardTitle>Amortization Schedule (First 12 Periods)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-zinc-500 uppercase border-b border-white/5">
                        <th className="text-left py-2 pr-4">#</th>
                        <th className="text-right py-2 px-2">Payment</th>
                        <th className="text-right py-2 px-2">Interest</th>
                        <th className="text-right py-2 px-2">Principal</th>
                        <th className="text-right py-2 pl-2">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.schedule as Array<Record<string, unknown>>).slice(0, 12).map((row) => (
                        <tr key={row.period} className="border-b border-white/5 last:border-0">
                          <td className="py-2 pr-4 text-zinc-400">{row.period}</td>
                          <td className="text-right py-2 px-2">{formatCurrency(row.payment)}</td>
                          <td className="text-right py-2 px-2 text-red-400">
                            {formatCurrency(row.interest)}
                          </td>
                          <td className="text-right py-2 px-2 text-emerald-400">
                            {formatCurrency(row.principal)}
                          </td>
                          <td className="text-right py-2 pl-2">{formatCurrency(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.scheduleLength && result.scheduleLength > 12 && (
                    <p className="text-xs text-zinc-500 mt-2 text-center">
                      Showing 12 of {result.scheduleLength} periods
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
