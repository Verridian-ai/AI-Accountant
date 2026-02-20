import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowRightLeft, TrendingDown, Calculator, Users } from 'lucide-react';
import { loanApi } from '@/api';
import type { RefinanceResult, BorrowingCapacityResult } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

export function LoanComparisonPanel() {
  return (
    <Tabs defaultValue="refinance" className="space-y-4">
      <TabsList>
        <TabsTrigger value="refinance">
          <ArrowRightLeft className="w-4 h-4 mr-2" /> Refinance
        </TabsTrigger>
        <TabsTrigger value="capacity">
          <Calculator className="w-4 h-4 mr-2" /> Borrowing Capacity
        </TabsTrigger>
      </TabsList>

      <TabsContent value="refinance">
        <RefinanceCalculator />
      </TabsContent>

      <TabsContent value="capacity">
        <BorrowingCapacityCalculator />
      </TabsContent>
    </Tabs>
  );
}

function RefinanceCalculator() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RefinanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState('400000');
  const [currentRate, setCurrentRate] = useState('6.5');
  const [remainingMonths, setRemainingMonths] = useState('300');
  const [newRate, setNewRate] = useState('5.8');
  const [newTerm, setNewTerm] = useState('300');
  const [switchingCosts, setSwitchingCosts] = useState('3000');

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loanApi.calculateRefinanceSavings({
        currentBalance: Math.round(parseFloat(balance) * 100),
        currentRate: parseFloat(currentRate) / 100,
        currentRemainingMonths: parseInt(remainingMonths, 10),
        newRate: parseFloat(newRate) / 100,
        newTermMonths: parseInt(newTerm, 10),
        switchingCosts: Math.round(parseFloat(switchingCosts) * 100),
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
      <Card className="neu-raised border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-cba-gold" />
            Refinance Savings
          </CardTitle>
          <CardDescription>Compare current vs new loan and calculate break-even</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Current Balance ($)</Label>
              <Input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Current Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={currentRate}
                onChange={(e) => setCurrentRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Remaining Months</Label>
              <Input
                type="number"
                value={remainingMonths}
                onChange={(e) => setRemainingMonths(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>New Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>New Term (months)</Label>
              <Input type="number" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Switching Costs ($)</Label>
              <Input
                type="number"
                value={switchingCosts}
                onChange={(e) => setSwitchingCosts(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleCalculate}
            disabled={loading}
            className="bg-cba-gold text-base hover:bg-[#e6b800]"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Calculate Savings
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
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="neu-raised border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Current Loan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-secondary">Monthly Payment</span>
                <span className="font-medium">{formatCurrency(result.currentMonthlyPayment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Total Cost</span>
                <span className="font-medium">{formatCurrency(result.currentTotalCost)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="neu-raised border-emerald-500/10">
            <CardHeader>
              <CardTitle className="text-base">New Loan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-secondary">Monthly Payment</span>
                <span className="font-medium">{formatCurrency(result.newMonthlyPayment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Total Cost</span>
                <span className="font-medium">{formatCurrency(result.newTotalCost)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-2 neu-raised border-cba-gold/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-around flex-wrap gap-4">
                <div className="text-center">
                  <p className="text-sm text-secondary">Monthly Saving</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(result.monthlySaving)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-secondary">Break Even</p>
                  <p className="text-2xl font-bold text-cba-gold">
                    {result.breakEvenMonths} months
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-secondary">Total Savings</p>
                  <p
                    className={`text-2xl font-bold ${result.totalSavings > 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {formatCurrency(result.totalSavings)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function BorrowingCapacityCalculator() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BorrowingCapacityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [income, setIncome] = useState('120000');
  const [otherIncome, setOtherIncome] = useState('0');
  const [debts, setDebts] = useState('500');
  const [expenses, setExpenses] = useState('3000');
  const [dependants, setDependants] = useState('0');
  const [rate, setRate] = useState('6.25');

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loanApi.calculateBorrowingCapacity({
        grossAnnualIncome: Math.round(parseFloat(income) * 100),
        otherIncome: Math.round(parseFloat(otherIncome) * 100),
        existingDebts: Math.round(parseFloat(debts) * 100),
        livingExpenses: Math.round(parseFloat(expenses) * 100),
        dependants: parseInt(dependants, 10),
        interestRate: parseFloat(rate) / 100,
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
      <Card className="neu-raised border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cba-gold" />
            Borrowing Capacity
          </CardTitle>
          <CardDescription>APRA-compliant estimate with 3% buffer rate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Gross Annual Income ($)</Label>
              <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} />
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
              <Label>Existing Monthly Debts ($)</Label>
              <Input type="number" value={debts} onChange={(e) => setDebts(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Monthly Living Expenses ($)</Label>
              <Input type="number" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dependants</Label>
              <Input
                type="number"
                value={dependants}
                onChange={(e) => setDependants(e.target.value)}
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

      {result && (
        <Card className="neu-raised border-cba-gold/10">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center mb-6">
              <p className="text-sm text-secondary">Maximum Borrowing</p>
              <p className="text-4xl font-bold text-cba-gold">
                {formatCurrency(result.maxBorrowing)}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex justify-between p-3 rounded-lg bg-overlay">
                <span className="text-secondary">Assessment Rate</span>
                <span className="font-medium">{formatPercent(result.assessmentRate)}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-overlay">
                <span className="text-secondary">Monthly Repayment</span>
                <span className="font-medium">{formatCurrency(result.monthlyRepayment)}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-overlay">
                <span className="text-secondary">Net Monthly Income</span>
                <span className="font-medium">{formatCurrency(result.netMonthlyIncome)}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-overlay">
                <span className="text-secondary">Surplus Income</span>
                <span
                  className={`font-medium ${result.surplusIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {formatCurrency(result.surplusIncome)}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-overlay">
                <span className="text-secondary">Debt Service Ratio</span>
                <span className="font-medium">{formatPercent(result.dsr)}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-overlay">
                <span className="text-secondary">HEM Floor</span>
                <span className="font-medium">{formatCurrency(result.hemFloor)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
