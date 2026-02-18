import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import type { TaxSummary } from '@/api';
import { formatCurrency } from '../helpers.js';

interface TaxSummaryTabProps {
  taxSummary: TaxSummary | null;
  selectedYear: string;
}

export function TaxSummaryTab({ taxSummary, selectedYear }: TaxSummaryTabProps) {
  if (!taxSummary) {
    return <TabsContent value="summary" className="space-y-4" />;
  }

  return (
    <TabsContent value="summary" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gross Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(taxSummary.grossIncomeCents)}</div>
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
              <span className="font-medium">{formatCurrency(taxSummary.grossIncomeCents)}</span>
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
              <span className="font-medium">{formatCurrency(taxSummary.taxPayableCents)}</span>
            </div>
            {taxSummary.medicareLevy > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Medicare Levy</span>
                <span>{formatCurrency(taxSummary.medicareLevy)}</span>
              </div>
            )}
            <div className="flex justify-between text-green-600">
              <span>Tax Withheld</span>
              <span className="font-medium">-{formatCurrency(taxSummary.taxWithheldCents)}</span>
            </div>
            <div className="border-t pt-4 flex justify-between text-lg font-bold">
              <span>{taxSummary.taxRefundCents > 0 ? 'Estimated Refund' : 'Amount Owing'}</span>
              <span
                className={taxSummary.taxRefundCents > 0 ? 'text-green-600' : 'text-destructive'}
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
    </TabsContent>
  );
}
