import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Car, Trophy } from 'lucide-react';
import { loanApi } from '@/api';
import type { CarFinanceComparison } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

export function CarFinanceCalculator() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CarFinanceComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [vehiclePrice, setVehiclePrice] = useState('45000');
  const [deposit, setDeposit] = useState('5000');
  const [termMonths, setTermMonths] = useState('60');
  const [personalRate, setPersonalRate] = useState('8.5');
  const [chattelRate, setChattelRate] = useState('6.5');
  const [novatedRate, setNovatedRate] = useState('7.0');
  const [taxRate, setTaxRate] = useState('32.5');
  const [gstRegistered, setGstRegistered] = useState(false);
  const [salary, setSalary] = useState('85000');

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loanApi.calculateCarFinance({
        vehiclePrice: Math.round(parseFloat(vehiclePrice) * 100),
        deposit: Math.round(parseFloat(deposit) * 100),
        termMonths: parseInt(termMonths),
        personalLoanRate: parseFloat(personalRate) / 100,
        chattelMortgageRate: parseFloat(chattelRate) / 100,
        novatedLeaseRate: parseFloat(novatedRate) / 100,
        marginalTaxRate: parseFloat(taxRate) / 100,
        gstRegistered,
        annualSalary: Math.round(parseFloat(salary) * 100),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const options = result ? [result.personalLoan, result.chattelMortgage, result.novatedLease] : [];

  return (
    <div className="space-y-6">
      <Card className="neu-raised border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-[#FFCC00]" />
            Car Finance Comparison
          </CardTitle>
          <CardDescription>
            Compare Personal Loan vs Chattel Mortgage vs Novated Lease
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Vehicle Price ($)</Label>
              <Input
                type="number"
                value={vehiclePrice}
                onChange={(e) => setVehiclePrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Deposit ($)</Label>
              <Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Term (months)</Label>
              <Input
                type="number"
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Personal Loan Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={personalRate}
                onChange={(e) => setPersonalRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Chattel Mortgage Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={chattelRate}
                onChange={(e) => setChattelRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Novated Lease Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={novatedRate}
                onChange={(e) => setNovatedRate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Marginal Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.5"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Annual Salary ($)</Label>
              <Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch id="gst" checked={gstRegistered} onCheckedChange={setGstRegistered} />
              <Label htmlFor="gst">GST Registered</Label>
            </div>
          </div>
          <Button
            onClick={handleCalculate}
            disabled={loading}
            className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#e6b800]"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Compare Options
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
        <div className="grid gap-4 md:grid-cols-3">
          {options.map((opt) => {
            const isCheapest = opt.type === result.cheapestOption;
            return (
              <Card
                key={opt.type}
                className={`neu-raised border-white/5 ${isCheapest ? 'ring-2 ring-[#FFCC00]/50' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{opt.type}</CardTitle>
                    {isCheapest && (
                      <Badge className="bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/20">
                        <Trophy className="w-3 h-3 mr-1" /> Best Value
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-400 text-sm">Monthly Payment</span>
                      <span className="font-bold">{formatCurrency(opt.monthlyPayment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 text-sm">Total Interest</span>
                      <span className="text-red-400">{formatCurrency(opt.totalInterest)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 text-sm">Tax Benefit</span>
                      <span className="text-emerald-400">{formatCurrency(opt.taxBenefit)}</span>
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between">
                      <span className="text-zinc-400 text-sm">After-Tax Cost</span>
                      <span className="font-bold text-lg">{formatCurrency(opt.afterTaxCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 text-sm">Effective Rate</span>
                      <span>{formatPercent(opt.effectiveRate)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
