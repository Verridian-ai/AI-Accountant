import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  ArrowRightLeft,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  MinusCircle,
} from 'lucide-react';
import { BASE_URL, getAuthHeaders } from '@/api';

interface RefinanceInput {
  currentLender: string;
  currentRate: string;
  currentBalance: string;
  remainingTermYears: string;
  monthlyRepayment: string;
  loanPurpose: string;
  features: string[];
  switchingCosts: string;
}

interface Alternative {
  lender: string;
  product: string;
  rate: number;
  comparison_rate: number;
  monthly_saving: number;
  annual_saving: number;
  lifetime_saving: number;
  break_even_months: number;
  feature_match: string[];
  recommendation: 'switch' | 'negotiate' | 'stay';
}

interface RefinanceResult {
  summary: {
    potential_annual_saving: number;
    best_rate: number;
    current_rate: number;
    recommendation: 'switch' | 'negotiate' | 'stay';
  };
  alternatives: Alternative[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

const LOAN_FEATURES = [
  'Offset Account',
  'Redraw Facility',
  'Extra Repayments',
  'Split Loan',
  'Fixed Rate Lock',
  'Interest Only Option',
];

const recommendationConfig = {
  switch: {
    label: 'Switch',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: CheckCircle,
  },
  negotiate: {
    label: 'Negotiate',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    icon: AlertTriangle,
  },
  stay: {
    label: 'Stay',
    color: 'bg-zinc-500/10 text-secondary border-zinc-500/20',
    icon: MinusCircle,
  },
};

async function fetchRefinanceAnalysis(params: Record<string, unknown>): Promise<RefinanceResult> {
  const res = await fetch(`${BASE_URL}/api/cdr/loans/refinance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to fetch refinance analysis');
  return res.json();
}

export function RefinanceAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RefinanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState<RefinanceInput>({
    currentLender: '',
    currentRate: '6.5',
    currentBalance: '500000',
    remainingTermYears: '25',
    monthlyRepayment: '3500',
    loanPurpose: 'owner_occupied',
    features: [],
    switchingCosts: '1500',
  });

  const updateField = <K extends keyof RefinanceInput>(key: K, value: RefinanceInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const toggleFeature = (feature: string) => {
    setInput((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRefinanceAnalysis({
        current_lender: input.currentLender,
        current_rate: parseFloat(input.currentRate) / 100,
        current_balance: Math.round(parseFloat(input.currentBalance) * 100),
        remaining_term_months: parseInt(input.remainingTermYears) * 12,
        monthly_repayment: Math.round(parseFloat(input.monthlyRepayment) * 100),
        loan_purpose: input.loanPurpose,
        required_features: input.features,
        switching_costs: Math.round(parseFloat(input.switchingCosts) * 100),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card className="neu-raised border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-cba-gold" />
            Refinance Analysis
          </CardTitle>
          <CardDescription>
            Compare your current loan against CDR market alternatives
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Current Lender</Label>
              <Input
                value={input.currentLender}
                onChange={(e) => updateField('currentLender', e.target.value)}
                placeholder="e.g. CBA, Westpac"
              />
            </div>
            <div className="space-y-2">
              <Label>Current Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={input.currentRate}
                onChange={(e) => updateField('currentRate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Current Balance ($)</Label>
              <Input
                type="number"
                value={input.currentBalance}
                onChange={(e) => updateField('currentBalance', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Remaining Term (years)</Label>
              <Input
                type="number"
                value={input.remainingTermYears}
                onChange={(e) => updateField('remainingTermYears', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Repayment ($)</Label>
              <Input
                type="number"
                value={input.monthlyRepayment}
                onChange={(e) => updateField('monthlyRepayment', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Loan Purpose</Label>
              <Select
                value={input.loanPurpose}
                onValueChange={(v) => updateField('loanPurpose', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner_occupied">Owner Occupied</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Switching Costs ($)</Label>
            <div className="max-w-xs">
              <Input
                type="number"
                value={input.switchingCosts}
                onChange={(e) => updateField('switchingCosts', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Required Features</Label>
            <div className="flex flex-wrap gap-2">
              {LOAN_FEATURES.map((feature) => (
                <Badge
                  key={feature}
                  className={`cursor-pointer transition-colors ${
                    input.features.includes(feature)
                      ? 'bg-cba-gold/20 text-cba-gold border-cba-gold/30'
                      : 'bg-overlay text-secondary border-border hover:bg-overlay-hover'
                  }`}
                  onClick={() => toggleFeature(feature)}
                >
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={loading}
            className="bg-cba-gold text-base hover:bg-[#e6b800]"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Analyze Refinance Options
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
          <Card
            className={`neu-raised ${
              result.summary.recommendation === 'switch'
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : result.summary.recommendation === 'negotiate'
                  ? 'border-yellow-500/20 bg-yellow-500/5'
                  : 'border-zinc-500/20 bg-zinc-500/5'
            }`}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-secondary">Potential Annual Saving</p>
                  <p className="text-3xl font-bold text-cba-gold">
                    {formatCurrency(result.summary.potential_annual_saving / 100)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-secondary mb-1">Best Available Rate</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {(result.summary.best_rate * 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted">
                    vs your {(result.summary.current_rate * 100).toFixed(2)}%
                  </p>
                </div>
                {(() => {
                  const cfg = recommendationConfig[result.summary.recommendation];
                  const Icon = cfg.icon;
                  return (
                    <Badge className={`${cfg.color} text-lg py-2 px-4`}>
                      <Icon className="w-5 h-5 mr-2" />
                      {cfg.label}
                    </Badge>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Alternatives Table */}
          {result.alternatives.length > 0 && (
            <Card className="neu-raised border-border/50">
              <CardHeader>
                <CardTitle>Market Alternatives</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted uppercase border-b border-border/50">
                        <th className="text-left py-2 pr-3">Lender</th>
                        <th className="text-left py-2 px-2">Product</th>
                        <th className="text-right py-2 px-2">Rate</th>
                        <th className="text-right py-2 px-2">Monthly Saving</th>
                        <th className="text-right py-2 px-2">Lifetime Saving</th>
                        <th className="text-right py-2 px-2">Break Even</th>
                        <th className="text-center py-2 pl-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.alternatives.map((alt, i) => {
                        const cfg = recommendationConfig[alt.recommendation];
                        return (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-3 pr-3 font-medium">{alt.lender}</td>
                            <td className="py-3 px-2 text-secondary">{alt.product}</td>
                            <td className="text-right py-3 px-2 text-emerald-400">
                              {(alt.rate * 100).toFixed(2)}%
                            </td>
                            <td className="text-right py-3 px-2">
                              {formatCurrency(alt.monthly_saving / 100)}
                            </td>
                            <td className="text-right py-3 px-2 font-medium text-cba-gold">
                              {formatCurrency(alt.lifetime_saving / 100)}
                            </td>
                            <td className="text-right py-3 px-2 text-secondary">
                              {alt.break_even_months} mo
                            </td>
                            <td className="text-center py-3 pl-2">
                              <Badge className={`${cfg.color} text-xs`}>{cfg.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feature Match */}
          {result.alternatives.some((a) => a.feature_match.length > 0) && (
            <Card className="neu-raised border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Feature Matching</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.alternatives
                    .filter((a) => a.feature_match.length > 0)
                    .map((alt, i) => (
                      <div key={i} className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium min-w-[120px]">{alt.lender}</span>
                        <div className="flex flex-wrap gap-1">
                          {alt.feature_match.map((f) => (
                            <Badge
                              key={f}
                              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
                            >
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
