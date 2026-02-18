import React from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { Sparkline, CHART_COLORS } from '@/components/charts';
import type { TaxCalculationResult } from '@/api';
import { formatCurrency, formatPercent } from '../helpers.js';

interface TaxCalculatorTabProps {
  loading: boolean;
  grossIncome: string;
  setGrossIncome: (v: string) => void;
  entityType: 'individual' | 'company' | 'trust' | 'super_fund';
  setEntityType: (v: 'individual' | 'company' | 'trust' | 'super_fund') => void;
  hasPrivateHealth: boolean;
  setHasPrivateHealth: (v: boolean) => void;
  taxResult: TaxCalculationResult | null;
  error: string | null;
  selectedYear: string;
  onCalculate: () => void;
}

export function TaxCalculatorTab({
  loading,
  grossIncome,
  setGrossIncome,
  entityType,
  setEntityType,
  hasPrivateHealth,
  setHasPrivateHealth,
  taxResult,
  error,
  selectedYear,
  onCalculate,
}: TaxCalculatorTabProps) {
  return (
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
              <Select
                value={entityType}
                onValueChange={(v) =>
                  setEntityType(v as 'individual' | 'company' | 'trust' | 'super_fund')
                }
              >
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
            <Switch id="health" checked={hasPrivateHealth} onCheckedChange={setHasPrivateHealth} />
            <Label htmlFor="health">I have private health insurance</Label>
          </div>
          <Button onClick={onCalculate} disabled={loading || !grossIncome}>
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
                <div className="text-2xl font-bold">{formatPercent(taxResult.effective_rate)}</div>
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
                  <span className="text-destructive">{formatCurrency(taxResult.total_tax)}</span>
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
  );
}
