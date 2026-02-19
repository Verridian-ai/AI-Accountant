import React, { useReducer, useEffect, useCallback, Suspense } from 'react';
import { Percent, ArrowUp, ArrowDown, Minus, Calculator } from 'lucide-react';
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

const FALLBACK_RATE_DATA: CashRateData = {
  currentRate: 4.35,
  previousRate: 4.35,
  lastDecision: '2024-11-05',
  nextMeeting: '2026-03-18',
  direction: 'hold',
};

const FALLBACK_HISTORY: RateDecision[] = [
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

interface State {
  rateData: CashRateData | null;
  history: RateDecision[];
  loading: boolean;
  error: string | null;
  loanAmount: number;
  currentLoanRate: number;
  rateChange: number;
}

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; rateData: CashRateData; history: RateDecision[] }
  | { type: 'LOAD_ERROR'; error: string; rateData: CashRateData; history: RateDecision[] }
  | { type: 'SET_LOAN_AMOUNT'; value: number }
  | { type: 'SET_LOAN_RATE'; value: number }
  | { type: 'SET_RATE_CHANGE'; value: number };

const INITIAL: State = {
  rateData: null,
  history: [],
  loading: true,
  error: null,
  loanAmount: 500000,
  currentLoanRate: 6.5,
  rateChange: 25,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, rateData: action.rateData, history: action.history };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error, rateData: action.rateData, history: action.history };
    case 'SET_LOAN_AMOUNT':
      return { ...state, loanAmount: action.value };
    case 'SET_LOAN_RATE':
      return { ...state, currentLoanRate: action.value };
    case 'SET_RATE_CHANGE':
      return { ...state, rateChange: action.value };
  }
}

const LazyRateDecisionChart = React.lazy(() => import('./RateDecisionChart'));

export function RateDecisionTracker() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const loadData = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
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

      const finalRate =
        cashRateResponse?.currentRate != null ? cashRateResponse : FALLBACK_RATE_DATA;

      const finalHistory: RateDecision[] =
        historyPoints.length > 0
          ? historyPoints.map((p, i) => ({
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
            }))
          : FALLBACK_HISTORY;

      dispatch({ type: 'LOAD_SUCCESS', rateData: finalRate, history: finalHistory });
    } catch {
      dispatch({
        type: 'LOAD_ERROR',
        error: 'Failed to load rate data',
        rateData: FALLBACK_RATE_DATA,
        history: FALLBACK_HISTORY,
      });
    }
  }, [dispatch]);

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

  const currentRepayment = calcMonthlyRepayment(state.loanAmount, state.currentLoanRate);
  const newRate = state.currentLoanRate + state.rateChange / 100;
  const newRepayment = calcMonthlyRepayment(state.loanAmount, newRate);
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

  if (state.loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skel-${i}`} className="neu-raised rounded-2xl p-6 animate-pulse">
            <div className="h-6 w-32 bg-zinc-700 rounded mb-3" />
            <div className="h-12 w-24 bg-zinc-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {state.error && (
        <div className="text-xs text-amber-400 neu-inset px-3 py-2 rounded-lg">{state.error}</div>
      )}

      {/* Current Rate Card */}
      {state.rateData && (
        <div className="neu-raised rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">
              RBA Cash Rate Target
            </p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-[#FFCC00]">
                {state.rateData.currentRate.toFixed(2)}%
              </span>
              <div className={`flex items-center gap-1 ${getDirectionColor(state.rateData.direction)}`}>
                {getDirectionIcon(state.rateData.direction)}
                <span className="text-sm font-bold capitalize">{state.rateData.direction}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Decision</p>
              <p className="text-sm text-white font-medium">
                {new Date(state.rateData.lastDecision).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Next Meeting</p>
              <p className="text-sm text-[#FFCC00] font-medium">
                {new Date(state.rateData.nextMeeting).toLocaleDateString('en-AU', {
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
        <Suspense fallback={<div className="h-64 animate-pulse bg-white/5 rounded-xl" />}>
          <LazyRateDecisionChart
            history={state.history}
            currentRate={state.rateData?.currentRate}
          />
        </Suspense>
      </div>

      {/* Decision Timeline */}
      <div className="neu-raised rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-4">Recent Decisions</h3>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {[...state.history]
            .reverse()
            .slice(0, 12)
            .map((decision) => (
              <div key={`decision-${decision.date}`} className="flex items-center gap-4 pl-2">
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
            <label htmlFor="rdt-loan" className="text-xs text-zinc-500 font-medium block mb-1">
              Loan Amount ($)
            </label>
            <input
              id="rdt-loan"
              type="number"
              value={state.loanAmount}
              onChange={(e) => dispatch({ type: 'SET_LOAN_AMOUNT', value: Number(e.target.value) })}
              className="w-full neu-inset px-3 py-2 rounded-lg text-sm text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label htmlFor="rdt-rate" className="text-xs text-zinc-500 font-medium block mb-1">
              Current Rate (%)
            </label>
            <input
              id="rdt-rate"
              type="number"
              step="0.01"
              value={state.currentLoanRate}
              onChange={(e) => dispatch({ type: 'SET_LOAN_RATE', value: Number(e.target.value) })}
              className="w-full neu-inset px-3 py-2 rounded-lg text-sm text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium block mb-1">Rate Change (bps)</p>
            <div className="flex gap-1">
              {[-50, -25, 25, 50].map((bp) => (
                <button
                  key={bp}
                  onClick={() => dispatch({ type: 'SET_RATE_CHANGE', value: bp })}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    state.rateChange === bp
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
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Current Monthly</p>
            <p className="text-sm font-bold text-white">
              ${currentRepayment.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">New Monthly</p>
            <p className="text-sm font-bold text-white">
              ${newRepayment.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Monthly Diff</p>
            <p className={`text-sm font-bold ${monthlyDiff > 0 ? 'text-red-400' : monthlyDiff < 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {monthlyDiff > 0 ? '+' : ''}${monthlyDiff.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Annual Impact</p>
            <p className={`text-sm font-bold ${annualDiff > 0 ? 'text-red-400' : annualDiff < 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {annualDiff > 0 ? '+' : ''}${annualDiff.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-600">
          <Percent className="w-3 h-3" />
          <span>
            Based on 30-year P&I loan at {newRate.toFixed(2)}% ({state.rateChange > 0 ? '+' : ''}
            {state.rateChange}bps from {state.currentLoanRate}%)
          </span>
        </div>
      </div>
    </div>
  );
}
