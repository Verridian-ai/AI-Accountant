import { useState } from 'react';
import { Check, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanComparisonProps {
  currentPlan?: string;
  selectedPlan?: string;
  onSelectPlan?: (planId: string) => void;
  isOnboarding?: boolean;
}

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  limits: {
    members: number;
    accounts: number;
    transactionsPerMonth: number;
    aiQueries: number;
    storageMB: number;
  };
  features: string[];
  missingFeatures: string[];
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'For getting started',
    limits: { members: 1, accounts: 2, transactionsPerMonth: 100, aiQueries: 10, storageMB: 50 },
    features: ['Basic transaction parsing', 'GST classification', 'BAS generation', 'Single user'],
    missingFeatures: ['Multi-account', 'AI insights', 'Cognee knowledge graph', 'Team collaboration', 'Priority support'],
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 29,
    annualPrice: 24,
    description: 'For sole traders',
    limits: { members: 3, accounts: 5, transactionsPerMonth: 1000, aiQueries: 100, storageMB: 500 },
    features: ['Everything in Starter', 'Multi-account support', 'AI categorization', 'Tax reports', 'Transfer detection'],
    missingFeatures: ['Cognee knowledge graph', 'Team collaboration', 'Priority support'],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 79,
    annualPrice: 66,
    description: 'For growing teams',
    limits: { members: 10, accounts: 20, transactionsPerMonth: 10000, aiQueries: 500, storageMB: 2000 },
    features: ['Everything in Professional', 'Cognee knowledge graph', 'Team collaboration', 'Custom dashboards', 'Anomaly detection'],
    missingFeatures: ['Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 199,
    annualPrice: 166,
    description: 'For large organisations',
    limits: { members: -1, accounts: -1, transactionsPerMonth: -1, aiQueries: -1, storageMB: -1 },
    features: ['Everything in Business', 'Unlimited everything', 'Priority support', 'Custom integrations', 'Dedicated account manager'],
    missingFeatures: [],
  },
];

export function PlanComparison({ currentPlan = '', selectedPlan, onSelectPlan, isOnboarding }: PlanComparisonProps) {
  const [annual, setAnnual] = useState(true);

  const activePlan = selectedPlan ?? currentPlan;

  const formatLimit = (val: number) => (val === -1 ? 'Unlimited' : val.toLocaleString());

  return (
    <div className="space-y-5">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn('text-sm font-bold', !annual ? 'text-zinc-200' : 'text-zinc-500')}>Monthly</span>
        <button
          type="button"
          onClick={() => setAnnual(!annual)}
          className={cn(
            'relative w-12 h-6 rounded-full transition-colors',
            annual ? 'bg-[#FFCC00]' : 'bg-zinc-700'
          )}
        >
          <div className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-[#0a0a0f] transition-transform',
            annual ? 'translate-x-6' : 'translate-x-0.5'
          )} />
        </button>
        <span className={cn('text-sm font-bold', annual ? 'text-zinc-200' : 'text-zinc-500')}>Annual</span>
        {annual && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 uppercase tracking-wider">
            Save 17%
          </span>
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isSelected = plan.id === activePlan;
          const price = annual ? plan.annualPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.id}
              className={cn(
                'neu-raised rounded-2xl border p-5 flex flex-col transition-all',
                isSelected
                  ? 'border-[#FFCC00]/50 shadow-[0_0_24px_rgba(255,204,0,0.1)]'
                  : 'border-white/5 hover:border-white/10'
              )}
            >
              {isCurrent && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FFCC00]/10 text-[#FFCC00] uppercase tracking-wider self-start mb-2">
                  Current Plan
                </span>
              )}

              <h4 className={cn('text-lg font-bold', isSelected ? 'text-[#FFCC00]' : 'text-zinc-200')}>
                {plan.name}
              </h4>
              <p className="text-xs text-zinc-500 mb-3">{plan.description}</p>

              <div className="mb-4">
                <span className="text-3xl font-black text-zinc-100">
                  {price === 0 ? 'Free' : `$${price}`}
                </span>
                {price > 0 && <span className="text-sm text-zinc-500">/mo</span>}
              </div>

              {/* Limits */}
              <div className="neu-inset rounded-xl p-3 mb-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Members</span>
                  <span className="font-bold text-zinc-300">{formatLimit(plan.limits.members)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Accounts</span>
                  <span className="font-bold text-zinc-300">{formatLimit(plan.limits.accounts)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Transactions/mo</span>
                  <span className="font-bold text-zinc-300">{formatLimit(plan.limits.transactionsPerMonth)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>AI Queries</span>
                  <span className="font-bold text-zinc-300">{formatLimit(plan.limits.aiQueries)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Storage</span>
                  <span className="font-bold text-zinc-300">{plan.limits.storageMB === -1 ? 'Unlimited' : `${plan.limits.storageMB} MB`}</span>
                </div>
              </div>

              {/* Features */}
              <div className="flex-1 space-y-1.5 mb-4">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-zinc-300">{f}</span>
                  </div>
                ))}
                {plan.missingFeatures.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <X className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
                    <span className="text-zinc-600">{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {onSelectPlan ? (
                <button
                  type="button"
                  onClick={() => onSelectPlan(plan.id)}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors',
                    isSelected
                      ? 'bg-[#FFCC00] text-[#0a0a0f]'
                      : 'border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                  )}
                >
                  {isSelected ? (
                    <><Check className="w-4 h-4" /> Selected</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Select</>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isCurrent}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors',
                    isCurrent
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633]'
                  )}
                >
                  {isCurrent ? 'Current' : 'Upgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
