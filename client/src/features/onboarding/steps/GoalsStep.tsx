import {
  Receipt,
  Calculator,
  TrendingDown,
  TrendingUp,
  Wallet,
  MinusCircle,
  PiggyBank,
  BarChart3,
  Check,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingStepProps } from '../types';
import { FINANCIAL_GOALS } from '../types';

const GOAL_ICONS: Record<string, React.ElementType> = {
  receipt: Receipt,
  calculator: Calculator,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  wallet: Wallet,
  'minus-circle': MinusCircle,
  'piggy-bank': PiggyBank,
  'bar-chart': BarChart3,
};

export function GoalsStep({ data, updateData }: OnboardingStepProps) {
  const toggleGoal = (goalId: string) => {
    const isSelected = data.selectedGoals.includes(goalId);
    if (isSelected) {
      updateData({
        selectedGoals: data.selectedGoals.filter((id) => id !== goalId),
      });
    } else {
      updateData({
        selectedGoals: [...data.selectedGoals, goalId],
      });
    }
  };

  // Get recommended goals based on entity type
  const recommendedGoals = (() => {
    if (data.entityType === 'individual') {
      return ['expense_tracking', 'savings_goals', 'debt_reduction'];
    }
    if (data.isRegisteredForGst) {
      return ['tax_optimization', 'bas_compliance', 'cash_flow'];
    }
    return ['tax_optimization', 'expense_tracking', 'income_growth'];
  })();

  return (
    <div className="p-6 sm:p-10 space-y-8">
      {/* Header */}
      <div className="text-center sm:text-left">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
          <span className="text-gradient-gold">What are your financial goals?</span>
        </h2>
        <p className="text-sm text-muted">
          Select the goals that matter most to you. We'll customize your dashboard and insights.
        </p>
      </div>

      {/* AI Recommendations */}
      {recommendedGoals.length > 0 && (
        <div className="neu-inset rounded-2xl p-5 border border-cba-gold/10 bg-cba-gold/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-cba-gold" />
            <span className="text-[10px] font-black uppercase text-cba-gold tracking-widest">
              Recommended for you
            </span>
          </div>
          <p className="text-xs text-secondary">
            Based on your profile as{' '}
            {data.entityType === 'individual'
              ? 'an individual'
              : `a ${data.entityType.replace('_', ' ')}`}
            {data.isRegisteredForGst && ' registered for GST'}, we recommend focusing on:{' '}
            <span className="text-primary">
              {recommendedGoals
                .map((id) => {
                  const goal = FINANCIAL_GOALS.find((g) => g.id === id);
                  return goal?.label;
                })
                .filter(Boolean)
                .join(', ')}
            </span>
          </p>
        </div>
      )}

      {/* Goals Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FINANCIAL_GOALS.map((goal) => {
          const Icon = GOAL_ICONS[goal.icon] || Receipt;
          const isSelected = data.selectedGoals.includes(goal.id);
          const isRecommended = recommendedGoals.includes(goal.id);

          return (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={cn(
                'relative p-5 rounded-2xl border text-left transition-all btn-press group',
                isSelected
                  ? 'border-cba-gold/30 bg-cba-gold/10'
                  : 'neu-raised-sm border-border/50 hover:border-border',
              )}
            >
              {/* Selection indicator */}
              <div
                className={cn(
                  'absolute top-4 right-4 w-6 h-6 rounded-lg flex items-center justify-center transition-all',
                  isSelected ? 'bg-cba-gold text-base' : 'bg-overlay border border-border',
                )}
              >
                {isSelected && <Check className="w-4 h-4" />}
              </div>

              {/* Recommended badge */}
              {isRecommended && !isSelected && (
                <div className="absolute top-4 right-12 flex items-center gap-1 px-2 py-1 rounded-md bg-cba-gold/10 border border-cba-gold/20">
                  <Sparkles className="w-3 h-3 text-cba-gold" />
                  <span className="text-[8px] font-bold uppercase text-cba-gold tracking-wider">
                    Recommended
                  </span>
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  'neu-inset p-3 rounded-xl w-fit mb-4 transition-colors',
                  isSelected ? 'text-cba-gold' : 'text-muted group-hover:text-secondary',
                )}
              >
                <Icon className="w-6 h-6" />
              </div>

              {/* Text */}
              <h3
                className={cn(
                  'font-bold text-sm mb-1 transition-colors',
                  isSelected ? 'text-cba-gold' : 'text-primary',
                )}
              >
                {goal.label}
              </h3>
              <p className="text-xs text-muted pr-8">{goal.description}</p>
            </button>
          );
        })}
      </div>

      {/* Selection count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-600">
          {data.selectedGoals.length === 0
            ? 'Select at least one goal to continue'
            : `${data.selectedGoals.length} goal${data.selectedGoals.length !== 1 ? 's' : ''} selected`}
        </p>
        {data.selectedGoals.length > 0 && (
          <button
            onClick={() => updateData({ selectedGoals: [] })}
            className="text-xs text-muted hover:text-primary transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

export default GoalsStep;
