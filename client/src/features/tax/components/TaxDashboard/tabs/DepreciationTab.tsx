import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TabsContent } from '@/components/ui/tabs';
import type { DepreciableAsset } from '@/api';
import { formatCurrency } from '../helpers.js';

interface DepreciationTabProps {
  depreciableAssets: DepreciableAsset[];
}

export function DepreciationTab({ depreciableAssets }: DepreciationTabProps) {
  return (
    <TabsContent value="depreciation" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Depreciable Assets</CardTitle>
          <CardDescription>Track depreciation on business and work-related assets</CardDescription>
        </CardHeader>
        <CardContent>
          {depreciableAssets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No depreciable assets recorded</p>
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
  );
}
