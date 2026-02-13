import { useState } from 'react';
import { Calculator, DollarSign, TrendingDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateSavings } from '@/api';

interface SavingsResult {
  productId: string;
  name: string;
  provider: string;
  newRate: number;
  monthlySaving: number;
  annualSaving: number;
  lifetimeSaving: number;
  newMonthlyRepayment: number;
}

export function SavingsCalculator() {
  const [currentRate, setCurrentRate] = useState(6.5);
  const [balance, setBalance] = useState(500000);
  const [monthlyRepayment, setMonthlyRepayment] = useState(3200);
  const [remainingTerm, setRemainingTerm] = useState(25);
  const [results, setResults] = useState<SavingsResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const result = await calculateSavings({
        currentRate: currentRate / 100,
        balance,
        monthlyRepayment,
        remainingTermYears: remainingTerm,
      });
      setResults(result.alternatives ?? result ?? []);
      setCalculated(true);
    } catch (e) {
      console.error('Failed to calculate savings', e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(v);

  const formatRate = (rate: number) => `${(rate * 100).toFixed(2)}%`;

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="neu-raised rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#FFCC00]" />
          How much could you save?
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">
              Current Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={currentRate}
              onChange={(e) => setCurrentRate(Number(e.target.value))}
              className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">Loan Balance</label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
              className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">
              Monthly Repayment
            </label>
            <input
              type="number"
              value={monthlyRepayment}
              onChange={(e) => setMonthlyRepayment(Number(e.target.value))}
              className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">
              Remaining Term (yrs)
            </label>
            <input
              type="number"
              value={remainingTerm}
              onChange={(e) => setRemainingTerm(Number(e.target.value))}
              className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-[#FFCC00] text-[#0a0a0f] text-sm font-bold hover:bg-[#FFD633] transition-colors disabled:opacity-50"
        >
          {loading ? 'Calculating...' : 'Find Savings'}
        </button>
      </div>

      {/* Results */}
      {calculated && (
        <>
          {results.length === 0 ? (
            <div className="neu-raised rounded-2xl p-8 text-center">
              <p className="text-zinc-500">No better alternatives found at this time</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zinc-300">
                {results.length} alternative{results.length !== 1 ? 's' : ''} found
              </h3>
              {results.map((r, idx) => (
                <div
                  key={r.productId || idx}
                  className={cn(
                    'neu-raised rounded-2xl p-5 space-y-3',
                    idx === 0 &&
                      'border border-[#FFCC00]/30 shadow-[0_0_20px_rgba(255,204,0,0.05)]',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-zinc-100">{r.name}</p>
                      <p className="text-xs text-zinc-500">{r.provider}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500 line-through">
                          {currentRate.toFixed(2)}%
                        </span>
                        <ArrowRight className="h-3 w-3 text-zinc-600" />
                        <span className="text-[#FFCC00] font-bold">{formatRate(r.newRate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3 text-emerald-400" />
                        <span className="text-[10px] text-zinc-500 uppercase">Monthly Saving</span>
                      </div>
                      <p className="text-lg font-black text-emerald-400">
                        {formatCurrency(r.monthlySaving)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingDown className="h-3 w-3 text-cyan-400" />
                        <span className="text-[10px] text-zinc-500 uppercase">Annual Saving</span>
                      </div>
                      <p className="text-lg font-black text-cyan-400">
                        {formatCurrency(r.annualSaving)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Calculator className="h-3 w-3 text-[#FFCC00]" />
                        <span className="text-[10px] text-zinc-500 uppercase">Lifetime Saving</span>
                      </div>
                      <p className="text-lg font-black text-[#FFCC00]">
                        {formatCurrency(r.lifetimeSaving)}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500">
                    New monthly repayment:{' '}
                    <span className="text-zinc-300 font-semibold">
                      {formatCurrency(r.newMonthlyRepayment)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
