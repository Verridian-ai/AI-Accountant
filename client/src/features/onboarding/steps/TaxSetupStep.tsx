import { Calculator, FileText, Calendar, HelpCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import type { OnboardingStepProps } from '../types';

const BAS_FREQUENCIES = [
  {
    id: 'monthly',
    label: 'Monthly',
    description: 'Submit BAS every month',
    threshold: 'Required if GST turnover > $20M',
  },
  {
    id: 'quarterly',
    label: 'Quarterly',
    description: 'Submit BAS every 3 months',
    threshold: 'Most common for small businesses',
  },
  {
    id: 'annually',
    label: 'Annually',
    description: 'Submit BAS once per year',
    threshold: 'GST turnover < $75,000',
  },
] as const;

const ACCOUNTING_METHODS = [
  {
    id: 'cash',
    label: 'Cash Basis',
    description: 'Report when money changes hands',
    icon: Calculator,
    details: 'Simpler for small businesses. GST is reported when you receive or make payments.',
  },
  {
    id: 'accrual',
    label: 'Accrual Basis',
    description: 'Report when invoiced/billed',
    icon: FileText,
    details:
      'Required for businesses with turnover > $10M. GST is reported when invoices are issued.',
  },
] as const;

export function TaxSetupStep({ data, updateData }: OnboardingStepProps) {
  const showGstOptions = data.entityType !== 'individual';

  return (
    <div className="p-6 sm:p-10 space-y-8">
      {/* Header */}
      <div className="text-center sm:text-left">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
          <span className="text-gradient-gold">Configure tax settings</span>
        </h2>
        <p className="text-sm text-muted">
          Set up your GST and BAS preferences for accurate reporting.
        </p>
      </div>

      {/* GST Registration Toggle */}
      {showGstOptions && (
        <div className="neu-raised rounded-2xl p-6 border border-border/50 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                GST Registration
                <HelpCircle className="w-4 h-4 text-zinc-600" />
              </h3>
              <p className="text-xs text-muted max-w-md">
                Are you registered for Goods and Services Tax (GST)? Registration is required if
                your annual turnover exceeds $75,000.
              </p>
            </div>
            <Switch
              checked={data.isRegisteredForGst}
              onCheckedChange={(checked) => updateData({ isRegisteredForGst: checked })}
            />
          </div>

          {!data.isRegisteredForGst && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/80">
                If your turnover exceeds $75,000, you must register for GST. You can still track GST
                for reporting purposes without being registered.
              </p>
            </div>
          )}
        </div>
      )}

      {/* BAS Frequency */}
      {showGstOptions && data.isRegisteredForGst && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2">
            <label htmlFor="taxset-f1" className="text-[10px] font-black uppercase text-muted tracking-widest">
              BAS Lodgement Frequency
            </label>
            <HelpCircle className="w-3 h-3 text-zinc-600" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BAS_FREQUENCIES.map((freq) => {
              const isSelected = data.basFrequency === freq.id;
              return (
                <button
                  key={freq.id}
                  onClick={() => updateData({ basFrequency: freq.id as typeof data.basFrequency })}
                  className={cn(
                    'p-4 rounded-2xl border text-left transition-all btn-press',
                    isSelected
                      ? 'cba-gold-gradient text-base border-transparent shadow-lg cba-gold-glow'
                      : 'neu-raised-sm border-border/50 hover:border-border',
                  )}
                >
                  <h4
                    className={cn(
                      'font-bold text-sm mb-1',
                      isSelected ? 'text-base' : 'text-primary',
                    )}
                  >
                    {freq.label}
                  </h4>
                  <p className={cn('text-xs', isSelected ? 'text-base/70' : 'text-muted')}>
                    {freq.description}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] mt-2',
                      isSelected ? 'text-base/60' : 'text-zinc-600',
                    )}
                  >
                    {freq.threshold}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Accounting Method */}
      {showGstOptions && data.isRegisteredForGst && (
        <div
          className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300"
          style={{ animationDelay: '100ms' }}
        >
          <div className="flex items-center gap-2">
            <label htmlFor="taxset-f2" className="text-[10px] font-black uppercase text-muted tracking-widest">
              Accounting Method
            </label>
            <HelpCircle className="w-3 h-3 text-zinc-600" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ACCOUNTING_METHODS.map((method) => {
              const Icon = method.icon;
              const isSelected = data.accountingMethod === method.id;
              return (
                <button
                  key={method.id}
                  onClick={() =>
                    updateData({ accountingMethod: method.id as typeof data.accountingMethod })
                  }
                  className={cn(
                    'p-5 rounded-2xl border text-left transition-all btn-press relative overflow-hidden',
                    isSelected
                      ? 'border-cba-gold/30 bg-cba-gold/5'
                      : 'neu-raised-sm border-border/50 hover:border-border',
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-cba-gold" />
                  )}
                  <div
                    className={cn(
                      'neu-inset p-2 rounded-xl w-fit mb-3',
                      isSelected ? 'text-cba-gold' : 'text-muted',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4
                    className={cn(
                      'font-bold text-sm mb-1',
                      isSelected ? 'text-cba-gold' : 'text-primary',
                    )}
                  >
                    {method.label}
                  </h4>
                  <p className="text-xs text-muted mb-2">{method.description}</p>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">{method.details}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial Year End */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <label htmlFor="taxset-f3" className="text-[10px] font-black uppercase text-muted tracking-widest">
            Financial Year End
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => updateData({ financialYearEnd: 'june' })}
            className={cn(
              'p-4 rounded-2xl border text-left transition-all btn-press flex items-center gap-4',
              data.financialYearEnd === 'june'
                ? 'cba-gold-gradient text-base border-transparent shadow-lg cba-gold-glow'
                : 'neu-raised-sm border-border/50 hover:border-border',
            )}
          >
            <Calendar
              className={cn(
                'w-6 h-6',
                data.financialYearEnd === 'june' ? 'text-base' : 'text-muted',
              )}
            />
            <div>
              <h4
                className={cn(
                  'font-bold text-sm',
                  data.financialYearEnd === 'june' ? 'text-base' : 'text-primary',
                )}
              >
                30 June
              </h4>
              <p
                className={cn(
                  'text-xs',
                  data.financialYearEnd === 'june' ? 'text-base/70' : 'text-muted',
                )}
              >
                Standard AU financial year
              </p>
            </div>
          </button>
          <button
            onClick={() => updateData({ financialYearEnd: 'december' })}
            className={cn(
              'p-4 rounded-2xl border text-left transition-all btn-press flex items-center gap-4',
              data.financialYearEnd === 'december'
                ? 'cba-gold-gradient text-base border-transparent shadow-lg cba-gold-glow'
                : 'neu-raised-sm border-border/50 hover:border-border',
            )}
          >
            <Calendar
              className={cn(
                'w-6 h-6',
                data.financialYearEnd === 'december' ? 'text-base' : 'text-muted',
              )}
            />
            <div>
              <h4
                className={cn(
                  'font-bold text-sm',
                  data.financialYearEnd === 'december' ? 'text-base' : 'text-primary',
                )}
              >
                31 December
              </h4>
              <p
                className={cn(
                  'text-xs',
                  data.financialYearEnd === 'december' ? 'text-base/70' : 'text-muted',
                )}
              >
                Calendar year
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Individual-specific info */}
      {!showGstOptions && (
        <div className="neu-inset rounded-2xl p-5 border border-cba-gold/10 bg-cba-gold/[0.02]">
          <p className="text-xs text-secondary leading-relaxed">
            <span className="text-cba-gold font-bold">For individuals:</span> GST and BAS settings
            don't apply to personal finances. We'll focus on tracking your income and deductible
            expenses for tax time.
          </p>
        </div>
      )}
    </div>
  );
}

export default TaxSetupStep;
