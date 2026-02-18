import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import type { CGTAsset, CGTEvent } from '@/api';
import { formatCurrency } from '../helpers.js';

interface CGTTabProps {
  cgtAssets: CGTAsset[];
  cgtEvents: CGTEvent[];
  totalCGT: number;
  selectedYear: string;
}

export function CGTTab({ cgtAssets, cgtEvents, totalCGT, selectedYear }: CGTTabProps) {
  return (
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
                <div key={e.id} className="flex items-center justify-between p-3 border rounded-lg">
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
  );
}
