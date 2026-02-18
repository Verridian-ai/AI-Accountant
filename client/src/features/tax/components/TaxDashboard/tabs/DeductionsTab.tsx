import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import { Sparkline, CHART_COLORS } from '@/components/charts';
import type { Deduction } from '@/api';
import { formatCurrency } from '../helpers.js';

interface DeductionsTabProps {
  deductions: Deduction[];
  totalDeductions: number;
  selectedYear: string;
}

export function DeductionsTab({ deductions, totalDeductions, selectedYear }: DeductionsTabProps) {
  return (
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
                <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{d.description}</p>
                    <p className="text-sm text-muted-foreground">{d.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{formatCurrency(d.amountCents)}</p>
                    {d.method && <Badge variant="outline">{d.method}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
