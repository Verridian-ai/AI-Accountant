import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Loader2, Calculator, Building2, TrendingUp, Receipt, PiggyBank } from 'lucide-react';
import { taxApi } from '@/api';
import type {
  TaxCalculationResult,
  TaxSummary,
  Deduction,
  CGTAsset,
  CGTEvent,
  DepreciableAsset,
} from '@/api';
import { Sparkline, CHART_COLORS } from '../../../components/charts';

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100);
};

const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(1)}%`;
};

const getCurrentTaxYear = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  // Australian tax year runs Jul 1 - Jun 30
  if (month >= 6) {
    return `${year}-${(year + 1).toString().slice(2)}`;
  }
  return `${year - 1}-${year.toString().slice(2)}`;
};

const generateTaxYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i < 5; i++) {
    const year = currentYear - i;
    years.push(`${year}-${(year + 1).toString().slice(2)}`);
  }
  return years;
};

export function TaxDashboard() {
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(getCurrentTaxYear());
  const [grossIncome, setGrossIncome] = useState('');
  const [entityType, setEntityType] = useState<'individual' | 'company' | 'trust' | 'super_fund'>(
    'individual',
  );
  const [hasPrivateHealth, setHasPrivateHealth] = useState(false);
  const [taxResult, setTaxResult] = useState<TaxCalculationResult | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [cgtAssets, setCgtAssets] = useState<CGTAsset[]>([]);
  const [cgtEvents, setCgtEvents] = useState<CGTEvent[]>([]);
  const [depreciableAssets, setDepreciableAssets] = useState<DepreciableAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTaxData();
  }, [selectedYear]);

  const loadTaxData = async () => {
    setLoading(true);
    try {
      const [summary, deductionsList, assets, events, depreciation] = await Promise.all([
        taxApi.fetchTaxSummary(selectedYear),
        taxApi.fetchDeductions(selectedYear),
        taxApi.fetchCGTAssets(),
        taxApi.fetchCGTEvents(selectedYear),
        taxApi.fetchDepreciableAssets(),
      ]);
      setTaxSummary(summary);
      setDeductions(deductionsList);
      setCgtAssets(assets);
      setCgtEvents(events);
      setDepreciableAssets(depreciation);

      // Auto-populate income from summary and trigger tax calc
      if (summary && summary.grossIncomeCents > 0) {
        const incomeDollars = (summary.grossIncomeCents / 100).toFixed(0);
        setGrossIncome(incomeDollars);
        // Auto-calculate tax from transactions
        try {
          const result = await taxApi.calculateTax(
            selectedYear,
            summary.grossIncomeCents,
            entityType,
            hasPrivateHealth,
          );
          setTaxResult(result);
        } catch (calcErr) {
          console.error('Auto tax calc failed:', calcErr);
        }
      }
    } catch (err) {
      console.error('Failed to load tax data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTax = async () => {
    if (!grossIncome) return;

    setLoading(true);
    setError(null);

    try {
      const incomeInCents = Math.round(parseFloat(grossIncome) * 100);
      const result = await taxApi.calculateTax(
        selectedYear,
        incomeInCents,
        entityType,
        hasPrivateHealth,
      );
      setTaxResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate tax');
    } finally {
      setLoading(false);
    }
  };

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amountCents, 0);
  const totalCGT = cgtEvents.reduce(
    (sum, e) => sum + e.capitalGainNetCents - e.capitalLossCents,
    0,
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight">Tax Return</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Calculate and manage your annual tax return
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
            <SelectValue placeholder="Tax Year" />
          </SelectTrigger>
          <SelectContent>
            {generateTaxYears().map((year) => (
              <SelectItem key={year} value={year} className="min-h-[44px]">
                FY {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="calculator" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 overflow-x-auto">
          <TabsTrigger value="calculator" className="min-h-[44px]">
            <Calculator className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Calculator</span>
            <span className="sm:hidden">Calc</span>
          </TabsTrigger>
          <TabsTrigger value="deductions" className="min-h-[44px]">
            <Receipt className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Deductions</span>
            <span className="sm:hidden">Ded.</span>
          </TabsTrigger>
          <TabsTrigger value="cgt" className="min-h-[44px]">
            <TrendingUp className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Capital Gains</span>
            <span className="sm:hidden">CGT</span>
          </TabsTrigger>
          <TabsTrigger value="depreciation" className="min-h-[44px]">
            <Building2 className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Depreciation</span>
            <span className="sm:hidden">Dep.</span>
          </TabsTrigger>
          <TabsTrigger value="summary" className="min-h-[44px]">
            <PiggyBank className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Summary</span>
            <span className="sm:hidden">Sum.</span>
          </TabsTrigger>
        </TabsList>

        {/* Tax Calculator Tab */}
        <TabsContent value="calculator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tax Calculator</CardTitle>
              <CardDescription>Calculate your estimated tax for {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="income">Gross Income (AUD)</Label>
                  <Input
                    id="income"
                    type="number"
                    placeholder="e.g., 85000"
                    value={grossIncome}
                    onChange={(e) => setGrossIncome(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select value={entityType} onValueChange={(v) => setEntityType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="trust">Trust</SelectItem>
                      <SelectItem value="super_fund">Super Fund</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="health"
                  checked={hasPrivateHealth}
                  onCheckedChange={setHasPrivateHealth}
                />
                <Label htmlFor="health">I have private health insurance</Label>
              </div>
              <Button onClick={calculateTax} disabled={loading || !grossIncome}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Calculate Tax
              </Button>
            </CardContent>
          </Card>

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {taxResult && (
            <>
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Taxable Income</CardTitle>
                      <Sparkline
                        data={[62000, 68000, 71000, 74000, 78000, 82000]}
                        width={80}
                        height={24}
                        color={CHART_COLORS.primary}
                        trend="up"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl sm:text-2xl font-bold">
                      {formatCurrency(taxResult.taxable_income)}
                    </div>
                    <p className="text-xs text-muted-foreground">After deductions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Total Tax</CardTitle>
                      <Sparkline
                        data={[12000, 14000, 15500, 16200, 17000, 18500]}
                        width={80}
                        height={24}
                        color={CHART_COLORS.expense}
                        trend="up"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(taxResult.total_tax)}
                    </div>
                    <p className="text-xs text-muted-foreground">Including Medicare levy</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Effective Rate</CardTitle>
                      <Sparkline
                        data={[19.4, 20.6, 21.8, 21.9, 21.8, 22.6]}
                        width={80}
                        height={24}
                        color={CHART_COLORS.primaryDark}
                        trend="flat"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatPercent(taxResult.effective_rate)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Marginal: {formatPercent(taxResult.marginal_rate)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Tax Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Income Tax</span>
                      <span className="font-medium">{formatCurrency(taxResult.income_tax)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Medicare Levy (2%)</span>
                      <span className="font-medium">{formatCurrency(taxResult.medicare_levy)}</span>
                    </div>
                    {taxResult.medicare_surcharge > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Medicare Levy Surcharge</span>
                        <span className="font-medium">
                          {formatCurrency(taxResult.medicare_surcharge)}
                        </span>
                      </div>
                    )}
                    {taxResult.lito > 0 && (
                      <div className="flex justify-between items-center text-green-600">
                        <span>Low Income Tax Offset</span>
                        <span className="font-medium">-{formatCurrency(taxResult.lito)}</span>
                      </div>
                    )}
                    <div className="border-t pt-4 flex justify-between items-center font-bold">
                      <span>Total Tax Payable</span>
                      <span className="text-destructive">
                        {formatCurrency(taxResult.total_tax)}
                      </span>
                    </div>
                  </div>

                  {taxResult.brackets_breakdown && taxResult.brackets_breakdown.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold mb-4">Tax Brackets</h4>
                      <div className="space-y-2">
                        {taxResult.brackets_breakdown.map((bracket, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{bracket.bracket}</span>
                            <span>
                              {formatCurrency(bracket.income_in_bracket)} @{' '}
                              {formatCurrency(bracket.tax_for_bracket)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Deductions Tab */}
        <TabsContent value="deductions" className="space-y-4">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
                  <Sparkline
                    data={[1800, 2200, 1950, 2400, 2600, 2900]}
                    width={80}
                    height={24}
                    color={CHART_COLORS.revenue}
                    trend="up"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalDeductions)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Items Claimed</CardTitle>
                  <Sparkline
                    data={[5, 7, 6, 8, 9, 11]}
                    width={80}
                    height={24}
                    color={CHART_COLORS.axis}
                    trend="up"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deductions.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Deductions</CardTitle>
              <CardDescription>Track your work-related expenses and deductions</CardDescription>
            </CardHeader>
            <CardContent>
              {deductions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No deductions recorded for {selectedYear}
                </p>
              ) : (
                <div className="space-y-2">
                  {deductions.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{d.description}</p>
                        <p className="text-sm text-muted-foreground">{d.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          {formatCurrency(d.amountCents)}
                        </p>
                        {d.method && <Badge variant="outline">{d.method}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Capital Gains Tab */}
        <TabsContent value="cgt" className="space-y-4">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Capital Gain</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${totalCGT >= 0 ? 'text-destructive' : 'text-green-600'}`}
                >
                  {formatCurrency(Math.abs(totalCGT))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalCGT >= 0 ? 'Taxable gain' : 'Net loss to carry forward'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cgtAssets.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Disposals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cgtEvents.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>CGT Events</CardTitle>
              <CardDescription>Capital gains and losses for {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              {cgtEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No CGT events recorded for {selectedYear}
                </p>
              ) : (
                <div className="space-y-2">
                  {cgtEvents.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">Disposal on {e.disposalDate}</p>
                        <div className="flex gap-2 mt-1">
                          {e.discountEligible && <Badge variant="secondary">50% Discount</Badge>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-medium ${e.capitalGainNetCents > 0 ? 'text-destructive' : 'text-green-600'}`}
                        >
                          {e.capitalGainNetCents > 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(e.capitalGainNetCents || e.capitalLossCents))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Proceeds: {formatCurrency(e.disposalProceedsCents)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Depreciation Tab */}
        <TabsContent value="depreciation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Depreciable Assets</CardTitle>
              <CardDescription>
                Track depreciation on business and work-related assets
              </CardDescription>
            </CardHeader>
            <CardContent>
              {depreciableAssets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No depreciable assets recorded
                </p>
              ) : (
                <div className="space-y-4">
                  {depreciableAssets.map((a) => {
                    const depreciatedPercent =
                      ((a.purchaseCostCents - a.currentValueCents) / a.purchaseCostCents) * 100;
                    return (
                      <div key={a.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{a.assetName}</p>
                            <p className="text-sm text-muted-foreground">
                              {a.assetType} - {a.depreciationMethod.replace('_', ' ')}
                            </p>
                          </div>
                          <Badge variant={a.isActive ? 'default' : 'secondary'}>
                            {a.isActive ? 'Active' : 'Disposed'}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Depreciated</span>
                            <span>{depreciatedPercent.toFixed(1)}%</span>
                          </div>
                          <Progress value={depreciatedPercent} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Purchase Cost</p>
                            <p className="font-medium">{formatCurrency(a.purchaseCostCents)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Current Value</p>
                            <p className="font-medium">{formatCurrency(a.currentValueCents)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Business Use</p>
                            <p className="font-medium">{a.businessUsePercent}%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          {taxSummary && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Gross Income</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(taxSummary.grossIncomeCents)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Deductions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      -{formatCurrency(taxSummary.totalDeductionsCents)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Taxable Income</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(taxSummary.taxableIncomeCents)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {taxSummary.taxRefundCents > 0 ? 'Estimated Refund' : 'Tax Payable'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${taxSummary.taxRefundCents > 0 ? 'text-green-600' : 'text-destructive'}`}
                    >
                      {formatCurrency(taxSummary.taxRefundCents || taxSummary.taxPayableCents)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Tax Year Summary - {selectedYear}</CardTitle>
                  <CardDescription>Overview of your tax position</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Gross Income</span>
                      <span className="font-medium">
                        {formatCurrency(taxSummary.grossIncomeCents)}
                      </span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Total Deductions</span>
                      <span className="font-medium">
                        -{formatCurrency(taxSummary.totalDeductionsCents)}
                      </span>
                    </div>
                    {taxSummary.netCapitalGainCents > 0 && (
                      <div className="flex justify-between">
                        <span>Net Capital Gain</span>
                        <span className="font-medium">
                          {formatCurrency(taxSummary.netCapitalGainCents)}
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-4 flex justify-between font-semibold">
                      <span>Taxable Income</span>
                      <span>{formatCurrency(taxSummary.taxableIncomeCents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax Payable</span>
                      <span className="font-medium">
                        {formatCurrency(taxSummary.taxPayableCents)}
                      </span>
                    </div>
                    {taxSummary.medicareLevy > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Medicare Levy</span>
                        <span>{formatCurrency(taxSummary.medicareLevy)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-green-600">
                      <span>Tax Withheld</span>
                      <span className="font-medium">
                        -{formatCurrency(taxSummary.taxWithheldCents)}
                      </span>
                    </div>
                    <div className="border-t pt-4 flex justify-between text-lg font-bold">
                      <span>
                        {taxSummary.taxRefundCents > 0 ? 'Estimated Refund' : 'Amount Owing'}
                      </span>
                      <span
                        className={
                          taxSummary.taxRefundCents > 0 ? 'text-green-600' : 'text-destructive'
                        }
                      >
                        {formatCurrency(taxSummary.taxRefundCents || taxSummary.taxPayableCents)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {taxSummary.carriedForwardLossesCents > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Carried Forward Losses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-muted-foreground">
                      {formatCurrency(taxSummary.carriedForwardLossesCents)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Capital losses that can be offset against future capital gains
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-4">
                <Badge variant={taxSummary.isFinalized ? 'default' : 'secondary'}>
                  {taxSummary.isFinalized ? 'Finalized' : 'Draft'}
                </Badge>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
