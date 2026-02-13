import { useState } from 'react';
import { Calculator, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoanResult {
  monthlyRepayment: number;
  totalInterest: number;
  totalCost: number;
  payoffDate: string;
  interestSaved: number;
}

function calculateLoan(
  amount: number,
  rate: number,
  termYears: number,
  repaymentType: 'pi' | 'io',
  extraRepayment: number,
  offsetBalance: number,
): LoanResult {
  const effectiveAmount = Math.max(0, amount - offsetBalance);
  const monthlyRate = rate / 100 / 12;
  const totalMonths = termYears * 12;

  let monthlyRepayment: number;
  if (repaymentType === 'io') {
    monthlyRepayment = effectiveAmount * monthlyRate;
  } else {
    if (monthlyRate === 0) {
      monthlyRepayment = effectiveAmount / totalMonths;
    } else {
      monthlyRepayment =
        (effectiveAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1);
    }
  }

  // Calculate with extra repayments
  let balance = effectiveAmount;
  let totalInterest = 0;
  let months = 0;
  const totalPayment = monthlyRepayment + extraRepayment;

  while (balance > 0 && months < totalMonths * 2) {
    const interest = balance * monthlyRate;
    totalInterest += interest;
    const principal = Math.min(balance, totalPayment - interest);
    balance -= principal;
    months++;
    if (repaymentType === 'io' && months >= totalMonths) break;
  }

  // Calculate baseline (no extra) for savings
  let baseInterest = 0;
  let baseBalance = effectiveAmount;
  for (let m = 0; m < totalMonths; m++) {
    const interest = baseBalance * monthlyRate;
    baseInterest += interest;
    if (repaymentType !== 'io') {
      const principal = monthlyRepayment - interest;
      baseBalance -= principal;
    }
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);

  return {
    monthlyRepayment: monthlyRepayment + extraRepayment,
    totalInterest,
    totalCost: effectiveAmount + totalInterest,
    payoffDate: payoffDate.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }),
    interestSaved: Math.max(0, baseInterest - totalInterest),
  };
}

export function LoanComparison() {
  const [amount, setAmount] = useState(500000);
  const [rate, setRate] = useState(6.0);
  const [term, setTerm] = useState(30);
  const [repaymentType, setRepaymentType] = useState<'pi' | 'io'>('pi');
  const [extraRepayment, setExtraRepayment] = useState(0);
  const [offsetBalance, setOffsetBalance] = useState(0);

  const result = calculateLoan(amount, rate, term, repaymentType, extraRepayment, offsetBalance);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(v);

  const summaryCards = [
    {
      label: 'Monthly Repayment',
      value: formatCurrency(result.monthlyRepayment),
      icon: DollarSign,
      color: 'text-[#FFCC00]',
    },
    {
      label: 'Total Interest',
      value: formatCurrency(result.totalInterest),
      icon: TrendingDown,
      color: 'text-red-400',
    },
    { label: 'Payoff Date', value: result.payoffDate, icon: Calendar, color: 'text-emerald-400' },
    {
      label: 'Interest Saved',
      value: formatCurrency(result.interestSaved),
      icon: Calculator,
      color: 'text-cyan-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="neu-raised rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#FFCC00]" />
          Loan Scenario Calculator
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">Loan Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">
              Interest Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">Term (years)</label>
            <input
              type="number"
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
              className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">Repayment Type</label>
            <div className="flex gap-2">
              {(['pi', 'io'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRepaymentType(t)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-sm font-bold transition-all',
                    repaymentType === t
                      ? 'bg-[#FFCC00] text-[#0a0a0f]'
                      : 'neu-raised-sm text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  {t === 'pi' ? 'P&I' : 'Interest Only'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">
              Extra Repayment/mo
            </label>
            <input
              type="number"
              value={extraRepayment}
              onChange={(e) => setExtraRepayment(Number(e.target.value))}
              className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-semibold block mb-1">Offset Balance</label>
            <input
              type="number"
              value={offsetBalance}
              onChange={(e) => setOffsetBalance(Number(e.target.value))}
              className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="neu-raised rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="neu-inset p-1.5 rounded-lg">
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
              <span className="text-xs text-zinc-500 font-semibold uppercase">{card.label}</span>
            </div>
            <p className={cn('text-xl font-black', card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Total Cost Breakdown */}
      <div className="neu-raised rounded-2xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-zinc-300">Cost Breakdown</h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Principal</span>
            <span className="text-zinc-200 font-semibold">
              {formatCurrency(Math.max(0, amount - offsetBalance))}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Total Interest</span>
            <span className="text-red-400 font-semibold">
              {formatCurrency(result.totalInterest)}
            </span>
          </div>
          <div className="border-t border-white/5 pt-2 flex justify-between text-sm">
            <span className="text-zinc-300 font-bold">Total Cost</span>
            <span className="text-[#FFCC00] font-black">{formatCurrency(result.totalCost)}</span>
          </div>
        </div>
        {/* Simple bar */}
        <div className="h-3 rounded-full overflow-hidden flex bg-[#1a1d23]">
          <div
            className="bg-[#FFCC00] rounded-l-full"
            style={{ width: `${(Math.max(0, amount - offsetBalance) / result.totalCost) * 100}%` }}
          />
          <div className="bg-red-500/70 rounded-r-full flex-1" />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>Principal</span>
          <span>Interest</span>
        </div>
      </div>
    </div>
  );
}
