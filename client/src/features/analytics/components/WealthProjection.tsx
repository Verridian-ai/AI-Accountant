import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, PiggyBank, TrendingUp } from 'lucide-react';
import { analyticsApi } from '@/api';
import type { WealthProjectionResult } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const PROFILE_COLORS: Record<string, string> = {
  Conservative: 'text-blue-400 border-blue-500/20',
  Balanced: 'text-emerald-400 border-emerald-500/20',
  Growth: 'text-amber-400 border-amber-500/20',
  'High Growth': 'text-red-400 border-red-500/20',
};

export function WealthProjection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WealthProjectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentSavings, setCurrentSavings] = useState('50000');
  const [monthlyContribution, setMonthlyContribution] = useState('2000');
  const [inflationRate, setInflationRate] = useState('3.0');

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsApi.calculateWealthProjection({
        currentSavings: Math.round(parseFloat(currentSavings) * 100),
        monthlyContribution: Math.round(parseFloat(monthlyContribution) * 100),
        inflationRate: parseFloat(inflationRate) / 100,
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
            <PiggyBank className="w-5 h-5 text-[#FFCC00]" />
            Wealth Projection
          </CardTitle>
          <CardDescription>
            Compound growth across 4 risk profiles with inflation adjustment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Current Savings ($)</Label>
              <Input
                type="number"
                value={currentSavings}
                onChange={(e) => setCurrentSavings(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Contribution ($)</Label>
              <Input
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Inflation Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={inflationRate}
                onChange={(e) => setInflationRate(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleCalculate}
            disabled={loading}
            className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#e6b800]"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Project Wealth
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

      {result && result.profiles.length > 0 && (
        <>
          {/* Profile Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {result.profiles.map((profile: any) => {
              const lastProjection = profile.projections[profile.projections.length - 1];
              const colorClass = PROFILE_COLORS[profile.name] ?? 'text-zinc-400 border-white/10';
              return (
                <Card key={profile.name} className="neu-raised border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                      <TrendingUp className={`w-4 h-4 ${colorClass.split(' ')[0]}`} />
                      {profile.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-xl font-bold ${colorClass.split(' ')[0]}`}>
                      {lastProjection ? formatCurrency(lastProjection.nominalValue) : '$0'}
                    </div>
                    {lastProjection && (
                      <p className="text-xs text-zinc-500 mt-1">
                        Real: {formatCurrency(lastProjection.realValue)} in {lastProjection.years}y
                      </p>
                    )}
                    <Badge variant="outline" className={`mt-2 text-xs ${colorClass}`}>
                      {formatPercent(profile.annualReturn)} p.a.
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detailed Timeline Table */}
          <Card className="neu-raised border-white/5">
            <CardHeader>
              <CardTitle>Projection Timeline</CardTitle>
              <CardDescription>
                Nominal and inflation-adjusted values across risk profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 uppercase border-b border-white/5">
                      <th className="text-left py-2 pr-4">Years</th>
                      {result.profiles.map((p: any) => (
                        <th key={p.name} className="text-right py-2 px-2" colSpan={2}>
                          {p.name}
                        </th>
                      ))}
                    </tr>
                    <tr className="text-xs text-zinc-600 border-b border-white/5">
                      <th className="py-1"></th>
                      {result.profiles.map((p: any) => (
                        <th key={`${p.name}-sub`} className="text-right py-1 px-1" colSpan={2}>
                          <span className="mr-3">Nominal</span>
                          <span>Real</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.profiles[0]?.projections.map((_: any, idx: number) => (
                      <tr key={idx} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-4 text-zinc-400">
                          {result.profiles[0]?.projections[idx]?.years}
                        </td>
                        {result.profiles.map((p: any) => (
                          <td key={p.name} className="text-right py-2 px-1" colSpan={2}>
                            <span className="mr-3 font-medium">
                              {formatCurrency(p.projections[idx]?.nominalValue ?? 0)}
                            </span>
                            <span className="text-zinc-500">
                              {formatCurrency(p.projections[idx]?.realValue ?? 0)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
