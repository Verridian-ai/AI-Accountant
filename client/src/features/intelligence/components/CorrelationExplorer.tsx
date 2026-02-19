import { useState } from 'react';
import { Search, Activity } from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import { intelligenceApi } from '../../../api';
import { cn } from '../../../lib/utils';

interface CorrelationExplorerProps {
  userId: string;
}

interface Correlation {
  id: string;
  moduleA: string;
  moduleB: string;
  coefficient: number;
  description: string;
  dataPoints: Array<{ x: number; y: number; label?: string }>;
  confidence: number;
}

const MODULES = [
  'transactions',
  'analytics',
  'tax',
  'bas',
  'gst',
  'knowledge',
  'documents',
  'matching',
  'intelligence',
];

function coefficientColor(coeff: number): string {
  if (coeff >= 0.7) return 'text-emerald-400';
  if (coeff >= 0.4) return 'text-cba-gold';
  if (coeff >= 0) return 'text-blue-400';
  if (coeff >= -0.4) return 'text-orange-400';
  return 'text-red-400';
}

function coefficientBg(coeff: number): string {
  if (coeff >= 0.7) return 'bg-emerald-500/10';
  if (coeff >= 0.4) return 'bg-cba-gold/10';
  if (coeff >= 0) return 'bg-blue-500/10';
  if (coeff >= -0.4) return 'bg-orange-500/10';
  return 'bg-red-500/10';
}

export function CorrelationExplorer({ userId }: CorrelationExplorerProps) {
  const [moduleA, setModuleA] = useState(MODULES[0]);
  const [moduleB, setModuleB] = useState(MODULES[1]);
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCorrelation, setSelectedCorrelation] = useState<Correlation | null>(null);

  const findCorrelations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await intelligenceApi.findCorrelations({
        userId,
        moduleA,
        moduleB,
      });
      const results = Array.isArray(data) ? data : (data.correlations ?? []);
      setCorrelations(results);
      setSelectedCorrelation(results[0] ?? null);
    } catch {
      setError('Failed to find correlations');
      setCorrelations([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="neu-raised p-4 rounded-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="correl-f1" className="text-xs text-muted font-medium block mb-1">Module A</label>
            <select id="correl-f1"
              value={moduleA}
              onChange={(e) => setModuleA(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-primary"
            >
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <span className="text-zinc-600 font-bold hidden sm:block pb-2">↔</span>
          <div className="flex-1">
            <label htmlFor="correl-f2" className="text-xs text-muted font-medium block mb-1">Module B</label>
            <select id="correl-f2"
              value={moduleB}
              onChange={(e) => setModuleB(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-primary"
            >
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={findCorrelations}
            disabled={loading || moduleA === moduleB}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cba-gold text-base font-bold text-sm hover:bg-cba-gold/90 transition-colors disabled:opacity-50 shrink-0"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Searching...' : 'Find Correlations'}
          </button>
        </div>
      </div>

      {error && <div className="neu-raised p-4 rounded-lg text-red-400 text-center">{error}</div>}

      {correlations.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Correlation cards */}
          <div className="space-y-2 lg:w-80 shrink-0">
            {correlations.map((corr) => (
              <button
                key={corr.id}
                onClick={() => setSelectedCorrelation(corr)}
                className={cn(
                  'w-full text-left neu-raised p-3 rounded-lg transition-all border',
                  selectedCorrelation?.id === corr.id
                    ? 'border-cba-gold/40'
                    : 'border-transparent hover:border-border',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary truncate flex-1">
                    {corr.description}
                  </span>
                  <div
                    className={cn(
                      'ml-2 px-2 py-0.5 rounded-full text-sm font-bold',
                      coefficientBg(corr.coefficient),
                      coefficientColor(corr.coefficient),
                    )}
                  >
                    {corr.coefficient >= 0 ? '+' : ''}
                    {corr.coefficient.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-muted">
                    {corr.moduleA} ↔ {corr.moduleB}
                  </span>
                  <span className="text-[10px] text-zinc-600">• {corr.confidence}% confidence</span>
                </div>
              </button>
            ))}
          </div>

          {/* Scatter plot */}
          {selectedCorrelation && (
            <div className="flex-1 neu-raised p-4 rounded-lg">
              <h4 className="text-sm font-bold text-primary mb-3">
                {selectedCorrelation.description}
              </h4>
              {selectedCorrelation.dataPoints && selectedCorrelation.dataPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name={selectedCorrelation.moduleA}
                      tick={{ fill: '#888', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={selectedCorrelation.moduleB}
                      tick={{ fill: '#888', fontSize: 11 }}
                    />
                    <ZAxis range={[40, 160]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1a2e',
                        border: '1px solid #333',
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: '#FFCC00' }}
                    />
                    <Scatter
                      data={selectedCorrelation.dataPoints}
                      fill="#FFCC00"
                      fillOpacity={0.6}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[350px] text-zinc-600">
                  <Activity className="w-6 h-6 mr-2 opacity-50" />
                  <span className="text-sm">No data points available for visualization.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {correlations.length === 0 && !loading && !error && (
        <div className="neu-raised p-8 rounded-lg text-center text-muted">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Select two modules and search for correlations.</p>
        </div>
      )}
    </div>
  );
}
