import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Plus, Trash2 } from 'lucide-react';
import { BASE_URL, getAuthHeaders } from '@/api';

interface CustomScenario {
  id: number;
  name: string;
  rate: string;
}

interface ScenarioResult {
  scenario: string;
  rate: number;
  monthly_repayment: number;
  total_interest: number;
  total_cost: number;
  difference_monthly: number;
  difference_total: number;
  source: 'cdr' | 'custom' | 'stress';
}

interface ScenariosResponse {
  base_rate: number;
  loan_amount: number;
  term_years: number;
  scenarios: ScenarioResult[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

async function fetchRateScenarios(params: Record<string, unknown>): Promise<ScenariosResponse> {
  const res = await fetch(`${BASE_URL}/api/cdr/loans/rate-scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to generate rate scenarios');
  return res.json();
}

let nextScenarioId = 1;

export function RateScenarios() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScenariosResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loanAmount, setLoanAmount] = useState('500000');
  const [termYears, setTermYears] = useState('30');
  const [currentRate, setCurrentRate] = useState('6.25');
  const [customScenarios, setCustomScenarios] = useState<CustomScenario[]>([]);

  const addCustomScenario = () => {
    setCustomScenarios((prev) => [...prev, { id: nextScenarioId++, name: '', rate: '' }]);
  };

  const removeCustomScenario = (id: number) => {
    setCustomScenarios((prev) => prev.filter((s) => s.id !== id));
  };

  const updateCustomScenario = (id: number, field: 'name' | 'rate', value: string) => {
    setCustomScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRateScenarios({
        loan_amount: Math.round(parseFloat(loanAmount) * 100),
        term_years: parseInt(termYears, 10),
        current_rate: parseFloat(currentRate) / 100,
        custom_scenarios: customScenarios
          .filter((s) => s.name && s.rate)
          .map((s) => ({ name: s.name, rate: parseFloat(s.rate) / 100 })),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate scenarios');
    } finally {
      setLoading(false);
    }
  };

  const sourceLabel = (source: string) => {
    switch (source) {
      case 'cdr':
        return { text: 'CDR', color: 'bg-cba-gold/10 text-cba-gold border-cba-gold/20' };
      case 'stress':
        return { text: 'Stress', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
      default:
        return { text: 'Custom', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    }
  };

  // Find the best (lowest monthly) and worst scenarios for highlighting
  const bestIdx =
    result?.scenarios.reduce(
      (best, s, i) =>
        s.monthly_repayment < (result.scenarios[best]?.monthly_repayment ?? Infinity) ? i : best,
      0,
    ) ?? -1;
  const worstIdx =
    result?.scenarios.reduce(
      (worst, s, i) =>
        s.monthly_repayment > (result.scenarios[worst]?.monthly_repayment ?? -Infinity) ? i : worst,
      0,
    ) ?? -1;

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card className="neu-raised border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cba-gold" />
            Rate Scenario Modeling
          </CardTitle>
          <CardDescription>
            Compare your rate against CDR market best, average, and stress scenarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Loan Amount ($)</Label>
              <Input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Term (years)</Label>
              <Input
                type="number"
                value={termYears}
                onChange={(e) => setTermYears(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Current Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={currentRate}
                onChange={(e) => setCurrentRate(e.target.value)}
              />
            </div>
          </div>

          {/* Custom Scenarios */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Custom Scenarios</Label>
              <Button variant="outline" size="sm" onClick={addCustomScenario} className="text-xs">
                <Plus className="w-3 h-3 mr-1" /> Add Scenario
              </Button>
            </div>
            {customScenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="grid gap-3 md:grid-cols-3 items-end p-3 rounded-lg bg-overlay"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Scenario Name</Label>
                  <Input
                    value={scenario.name}
                    onChange={(e) => updateCustomScenario(scenario.id, 'name', e.target.value)}
                    placeholder="e.g. My bank's offer"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={scenario.rate}
                    onChange={(e) => updateCustomScenario(scenario.id, 'rate', e.target.value)}
                    placeholder="5.50"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomScenario(scenario.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-cba-gold text-base hover:bg-[#e6b800]"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Generate Scenarios
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
          {/* Summary Banner */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="neu-raised border-border/50">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted">Loan Amount</p>
                <p className="text-xl font-bold">{formatCurrency(result.loan_amount / 100)}</p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-border/50">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted">Term</p>
                <p className="text-xl font-bold">{result.term_years} years</p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-cba-gold/10">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted">Base Rate</p>
                <p className="text-xl font-bold text-cba-gold">
                  {(result.base_rate * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Scenarios Table */}
          <Card className="neu-raised border-border/50">
            <CardHeader>
              <CardTitle>Scenario Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted uppercase border-b border-border/50">
                      <th className="text-left py-2 pr-3">Scenario</th>
                      <th className="text-right py-2 px-2">Rate</th>
                      <th className="text-right py-2 px-2">Monthly</th>
                      <th className="text-right py-2 px-2">Total Interest</th>
                      <th className="text-right py-2 px-2">Diff (Monthly)</th>
                      <th className="text-right py-2 pl-2">Diff (Total)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.scenarios.map((s, i) => {
                      const sl = sourceLabel(s.source);
                      const isBest = i === bestIdx;
                      const isWorst = i === worstIdx;
                      return (
                        <tr
                          key={i}
                          className={`border-b border-border/50 last:border-0 ${
                            isBest ? 'bg-emerald-500/5' : isWorst ? 'bg-red-500/5' : ''
                          }`}
                        >
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{s.scenario}</span>
                              <Badge className={`${sl.color} text-[10px]`}>{sl.text}</Badge>
                              {isBest && (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                                  Best
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="text-right py-3 px-2 font-medium">
                            {(s.rate * 100).toFixed(2)}%
                          </td>
                          <td className="text-right py-3 px-2">
                            {formatCurrency(s.monthly_repayment / 100)}
                          </td>
                          <td className="text-right py-3 px-2 text-secondary">
                            {formatCurrency(s.total_interest / 100)}
                          </td>
                          <td
                            className={`text-right py-3 px-2 ${
                              s.difference_monthly < 0
                                ? 'text-emerald-400'
                                : s.difference_monthly > 0
                                  ? 'text-red-400'
                                  : 'text-secondary'
                            }`}
                          >
                            {s.difference_monthly !== 0 && (s.difference_monthly > 0 ? '+' : '')}
                            {s.difference_monthly === 0
                              ? '—'
                              : formatCurrency(s.difference_monthly / 100)}
                          </td>
                          <td
                            className={`text-right py-3 pl-2 ${
                              s.difference_total < 0
                                ? 'text-emerald-400'
                                : s.difference_total > 0
                                  ? 'text-red-400'
                                  : 'text-secondary'
                            }`}
                          >
                            {s.difference_total !== 0 && (s.difference_total > 0 ? '+' : '')}
                            {s.difference_total === 0
                              ? '—'
                              : formatCurrency(s.difference_total / 100)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Visual Rate Bars */}
          <Card className="neu-raised border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Monthly Repayment Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.scenarios.map((s, i) => {
                  const maxRepayment = Math.max(
                    ...result.scenarios.map((x) => x.monthly_repayment),
                  );
                  const pct = maxRepayment > 0 ? (s.monthly_repayment / maxRepayment) * 100 : 0;
                  const isBest = i === bestIdx;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-secondary">{s.scenario}</span>
                        <span className="font-medium">
                          {formatCurrency(s.monthly_repayment / 100)}/mo
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-overlay overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isBest
                              ? 'bg-emerald-500'
                              : s.source === 'stress'
                                ? 'bg-red-500'
                                : 'bg-cba-gold'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
