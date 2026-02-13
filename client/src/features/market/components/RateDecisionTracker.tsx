import { useState, useEffect, useCallback } from 'react';
import { Percent, ArrowUp, ArrowDown, Minus, Calculator } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { fetchCashRate, fetchIndicatorHistory } from '../../../api';

interface CashRateData {
  currentRate: number;
  previousRate: number;
  lastDecision: string;
  nextMeeting: string;
  direction: 'hold' | 'increase' | 'decrease';
}

interface RateDecision {
  date: string;
  rate: number;
  change: number;
  direction: 'hold' | 'increase' | 'decrease';
}

export function RateDecisionTracker() {
  const [rateData, setRateData] = useState<CashRateData | null>(null);
  const [history, setHistory] = useState<RateDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Impact calculator state
  const [loanAmount, setLoanAmount] = useState(500000);
  const [currentLoanRate, setCurrentLoanRate] = useState(6.5);
  const [rateChange, setRateChange] = useState(25); // basis points

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      let cashRateResponse: CashRateData | null = null;
      try {
        const data = await fetchCashRate();
        cashRateResponse = data as CashRateData;
      } catch {
        // ignore
      }

      let historyPoints: Array<{ date: string; value: number }> = [];
      try {
        const hData = await fetchIndicatorHistory('RBA_CASH_RATE', 36);
        historyPoints = Array.isArray(hData)
          ? hData
          : (hData as { history: Array<{ date: string; value: number }> }).history || [];
      } catch {
        // ignore
      }

      if (cashRateResponse && cashRateResponse.currentRate != null) {
        setRateData(cashRateResponse);
      } else {
        setRateData({
          currentRate: 4.35,
          previousRate: 4.35,
          lastDecision: '2024-11-05',
          nextMeeting: '2026-03-18',
          direction: 'hold',
        });
      }

      if (historyPoints.length > 0) {
        const decisions: RateDecision[] = historyPoints.map((p, i) => ({
          date: p.date,
          rate: p.value,
          change: i > 0 ? Number(((p.value - historyPoints[i - 1].value) * 100).toFixed(0)) : 0,
          direction:
            i > 0
              ? p.value > historyPoints[i - 1].value
                ? 'increase'
                : p.value < historyPoints[i - 1].value
                  ? 'decrease'
                  : 'hold'
              : 'hold',
        }));
        setHistory(decisions);
      } else {
        // Fallback history
        const fallback: RateDecision[] = [
          { date: '2023-06', rate: 4.1, change: 25, direction: 'increase' },
          { date: '2023-08', rate: 4.1, change: 0, direction: 'hold' },
          { date: '2023-09', rate: 4.1, change: 0, direction: 'hold' },
          { date: '2023-11', rate: 4.35, change: 25, direction: 'increase' },
          { date: '2023-12', rate: 4.35, change: 0, direction: 'hold' },
          { date: '2024-02', rate: 4.35, change: 0, direction: 'hold' },
          { date: '2024-03', rate: 4.35, change: 0, direction: 'hold' },
          { date: '2024-05', rate: 4.35, change: 0, direction: 'hold' },
          { date: '2024-06', rate: 4.35, change: 0, direction: 'hold' },
          { date: '2024-08', rate: 4.35, change: 0, direction: 'hold' },
          { date: '2024-09', rate: 4.35, change: 0, direction: 'hold' },
          { date: '2024-11', rate: 4.35, change: 0, direction: 'hold' },
        ];
        setHistory(fallback);
      }
    } catch {
      setError('Failed to load rate data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate monthly repayment (P&I)
  const calcMonthlyRepayment = (principal: number, annualRate: number, years: number = 30) => {
    const monthlyRate = annualRate / 100 / 12;
    const n = years * 12;
    if (monthlyRate === 0) return principal / n;
    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    );
  };

  const currentRepayment = calcMonthlyRepayment(loanAmount, currentLoanRate);
  const newRate = currentLoanRate + rateChange / 100;
  const newRepayment = calcMonthlyRepayment(loanAmount, newRate);
  const monthlyDiff = newRepayment - currentRepayment;
  const annualDiff = monthlyDiff * 12;

  const getDirectionIcon = (dir: string) => {
    switch (dir) {
      case 'increase':
        return <ArrowUp className="w-5 h-5 text-red-400" />;
      case 'decrease':
        return <ArrowDown className="w-5 h-5 text-emerald-400" />;
      default:
        return <Minus className="w-5 h-5 text-zinc-400" />;
    }
  };

  const getDirectionColor = (dir: string) => {
    switch (dir) {
      case 'increase':
        return 'text-red-400';
      case 'decrease':
        return 'text-emerald-400';
      default:
        return 'text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="neu-raised rounded-2xl p-6 animate-pulse">
            <div className="h-6 w-32 bg-zinc-700 rounded mb-3" />
            <div className="h-12 w-24 bg-zinc-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-xs text-amber-400 neu-inset px-3 py-2 rounded-lg">{error}</div>
      )}

      {/* Current Rate Card */}
      {rateData && (
        <div className="neu-raised rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">
              RBA Cash Rate Target
            </p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-[#FFCC00]">
                {rateData.currentRate.toFixed(2)}%
              </span>
              <div className={`flex items-center gap-1 ${getDirectionColor(rateData.direction)}`}>
                {getDirectionIcon(rateData.direction)}
                <span className="text-sm font-bold capitalize">{rateData.direction}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Decision</p>
              <p className="text-sm text-white font-medium">
                {new Date(rateData.lastDecision).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Next Meeting</p>
              <p className="text-sm text-[#FFCC00] font-medium">
                {new Date(rateData.nextMeeting).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rate History Chart */}
      <div className="neu-raised rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-4">Rate Decision History</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid rgba(255,204,0,0.2)',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Cash Rate']}
              />
              {rateData && (
                <ReferenceLine
                  y={rateData.currentRate}
                  stroke="#FFCC00"
                  strokeDasharray="5 5"
                  label={{ value: 'Current', fill: '#FFCC00', fontSize: 10 }}
                />
              )}
              <Line
                type="stepAfter"
                dataKey="rate"
                stroke="#FFCC00"
                strokeWidth={2}
                dot={{ fill: '#FFCC00', r: 4 }}
                activeDot={{ r: 6, fill: '#FFCC00' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Decision Timeline */}
      <div className="neu-raised rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-4">Recent Decisions</h3>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {[...history]
            .reverse()
            .slice(0, 12)
            .map((decision, idx) => (
              <div key={idx} className="flex items-center gap-4 pl-2">
                <div className="relative">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      decision.direction === 'increase'
                        ? 'bg-red-500'
                        : decision.direction === 'decrease'
                          ? 'bg-emerald-500'
                          : 'bg-zinc-600'
                    }`}
                  />
                  {idx < Math.min(history.length, 12) - 1 && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-8 bg-zinc-700" />
                  )}
                </div>
                <div className="flex-1 flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-white">{decision.rate.toFixed(2)}%</p>
                    <p className="text-xs text-zinc-500">{decision.date}</p>
                  </div>
                  <span className={`text-xs font-bold ${getDirectionColor(decision.direction)}`}>
                    {decision.direction === 'increase'
                      ? `+${decision.change}bps`
                      : decision.direction === 'decrease'
                        ? `${decision.change}bps`
                        : 'Hold'}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Rate Impact Calculator */}
      <div className="neu-raised rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#FFCC00]" />
          Rate Impact Calculator
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-zinc-500 font-medium block mb-1">Loan Amount ($)</label>
            <input
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              className="w-full neu-inset px-3 py-2 rounded-lg text-sm text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium block mb-1">Current Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={currentLoanRate}
              onChange={(e) => setCurrentLoanRate(Number(e.target.value))}
              className="w-full neu-inset px-3 py-2 rounded-lg text-sm text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium block mb-1">
              Rate Change (bps)
            </label>
            <div className="flex gap-1">
              {[-50, -25, 25, 50].map((bp) => (
                <button
                  key={bp}
                  onClick={() => setRateChange(bp)}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    rateChange === bp
                      ? bp > 0
                        ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'text-zinc-500 hover:text-zinc-300 neu-raised-sm'
                  }`}
                >
                  {bp > 0 ? '+' : ''}
                  {bp}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
              Current Monthly
            </p>
            <p className="text-sm font-bold text-white">
              $
              {currentRepayment.toLocaleString('en-AU', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">New Monthly</p>
            <p className="text-sm font-bold text-white">
              $
              {newRepayment.toLocaleString('en-AU', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Monthly Diff</p>
            <p
              className={`text-sm font-bold ${monthlyDiff > 0 ? 'text-red-400' : monthlyDiff < 0 ? 'text-emerald-400' : 'text-zinc-400'}`}
            >
              {monthlyDiff > 0 ? '+' : ''}$
              {monthlyDiff.toLocaleString('en-AU', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Annual Impact</p>
            <p
              className={`text-sm font-bold ${annualDiff > 0 ? 'text-red-400' : annualDiff < 0 ? 'text-emerald-400' : 'text-zinc-400'}`}
            >
              {annualDiff > 0 ? '+' : ''}$
              {annualDiff.toLocaleString('en-AU', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-600">
          <Percent className="w-3 h-3" />
          <span>
            Based on 30-year P&I loan at {newRate.toFixed(2)}% ({rateChange > 0 ? '+' : ''}
            {rateChange}bps from {currentLoanRate}%)
          </span>
        </div>
      </div>
    </div>
  );
}
