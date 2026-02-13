import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, Check, X, Sparkles, ExternalLink } from 'lucide-react';
import { taxApi } from '@/api';
import type { TaxStrategyRecord } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function TaxOptimizerPanel({ year }: { year: string }) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [strategies, setStrategies] = useState<TaxStrategyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadStrategies = () => {
    setLoading(true);
    taxApi
      .fetchStrategies(year)
      .then(setStrategies)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStrategies();
  }, [year]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await taxApi.generateStrategies(year);
      loadStrategies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate strategies');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'suggested' | 'applied' | 'dismissed') => {
    try {
      await taxApi.updateStrategyStatus(id, status);
      setStrategies((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    } catch (err) {
      console.error('Failed to update strategy:', err);
    }
  };

  const suggested = strategies.filter((s) => s.status === 'suggested');
  const applied = strategies.filter((s) => s.status === 'applied');
  const dismissed = strategies.filter((s) => s.status === 'dismissed');
  const totalPotentialSavings = suggested.reduce((sum, s) => sum + s.estimatedSaving, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
        <span className="ml-2 text-zinc-400">Loading strategies...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with generate button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Tax Optimization Strategies</h3>
          {totalPotentialSavings > 0 && (
            <p className="text-sm text-emerald-400">
              Potential savings: {formatCurrency(totalPotentialSavings)}
            </p>
          )}
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#e6b800]"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {generating ? 'Analyzing...' : 'Generate Strategies'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/20">
          <CardContent className="pt-6">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Suggested Strategies */}
      {suggested.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Suggested</h4>
          {suggested.map((s) => (
            <Card
              key={s.id}
              className="neu-raised border-[#FFCC00]/10 hover:border-[#FFCC00]/30 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-[#FFCC00]" />
                    <CardTitle className="text-base">{s.strategyName}</CardTitle>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Save {formatCurrency(s.estimatedSaving)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400 mb-3">{s.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Confidence: {Math.round(s.confidence * 100)}%
                    </Badge>
                    {s.atoRulingRef && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> {s.atoRulingRef}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(s.id, 'dismissed')}
                      className="text-zinc-400 hover:text-red-400"
                    >
                      <X className="w-4 h-4 mr-1" /> Dismiss
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(s.id, 'applied')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="w-4 h-4 mr-1" /> Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Applied Strategies */}
      {applied.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Applied</h4>
          {applied.map((s) => (
            <Card key={s.id} className="neu-raised border-emerald-500/20 opacity-80">
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="font-medium">{s.strategyName}</p>
                    <p className="text-sm text-zinc-500">
                      Saving: {formatCurrency(s.estimatedSaving)}
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400">Applied</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dismissed */}
      {dismissed.length > 0 && (
        <details className="group">
          <summary className="text-sm font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-400">
            Dismissed ({dismissed.length})
          </summary>
          <div className="mt-3 space-y-2">
            {dismissed.map((s) => (
              <Card key={s.id} className="neu-raised opacity-50">
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <span className="text-sm text-zinc-500 line-through">{s.strategyName}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUpdateStatus(s.id, 'suggested')}
                  >
                    Restore
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      )}

      {strategies.length === 0 && !generating && (
        <Card className="neu-raised border-white/5">
          <CardContent className="pt-6 text-center">
            <Lightbulb className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No strategies generated yet.</p>
            <p className="text-sm text-zinc-500 mt-1">
              Click "Generate Strategies" to analyze your tax position and find savings.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
