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
        <p className="text-sm text-zinc-500">
          Set up your GST and BAS preferences for accurate reporting.
        </p>
      </div>

      {/* GST Registration Toggle */}
      {showGstOptions && (
        <div className="neu-raised rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                GST Registration
                <HelpCircle className="w-4 h-4 text-zinc-600" />
              </h3>
              <p className="text-xs text-zinc-500 max-w-md">
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
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
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
                      ? 'cba-gold-gradient text-[#0a0a0f] border-transparent shadow-lg cba-gold-glow'
                      : 'neu-raised-sm border-white/5 hover:border-white/10',
                  )}
                >
                  <h4
                    className={cn(
                      'font-bold text-sm mb-1',
                      isSelected ? 'text-[#0a0a0f]' : 'text-zinc-200',
                    )}
                  >
                    {freq.label}
                  </h4>
                  <p className={cn('text-xs', isSelected ? 'text-[#0a0a0f]/70' : 'text-zinc-500')}>
                    {freq.description}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] mt-2',
                      isSelected ? 'text-[#0a0a0f]/60' : 'text-zinc-600',
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
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
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
                      ? 'border-[#FFCC00]/30 bg-[#FFCC00]/5'
                      : 'neu-raised-sm border-white/5 hover:border-white/10',
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#FFCC00]" />
                  )}
                  <div
                    className={cn(
                      'neu-inset p-2 rounded-xl w-fit mb-3',
                      isSelected ? 'text-[#FFCC00]' : 'text-zinc-500',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4
                    className={cn(
                      'font-bold text-sm mb-1',
                      isSelected ? 'text-[#FFCC00]' : 'text-zinc-200',
                    )}
                  >
                    {method.label}
                  </h4>
                  <p className="text-xs text-zinc-500 mb-2">{method.description}</p>
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
          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
            Financial Year End
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => updateData({ financialYearEnd: 'june' })}
            className={cn(
              'p-4 rounded-2xl border text-left transition-all btn-press flex items-center gap-4',
              data.financialYearEnd === 'june'
                ? 'cba-gold-gradient text-[#0a0a0f] border-transparent shadow-lg cba-gold-glow'
                : 'neu-raised-sm border-white/5 hover:border-white/10',
            )}
          >
            <Calendar
              className={cn(
                'w-6 h-6',
                data.financialYearEnd === 'june' ? 'text-[#0a0a0f]' : 'text-zinc-500',
              )}
            />
            <div>
              <h4
                className={cn(
                  'font-bold text-sm',
                  data.financialYearEnd === 'june' ? 'text-[#0a0a0f]' : 'text-zinc-200',
                )}
              >
                30 June
              </h4>
              <p
                className={cn(
                  'text-xs',
                  data.financialYearEnd === 'june' ? 'text-[#0a0a0f]/70' : 'text-zinc-500',
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
                ? 'cba-gold-gradient text-[#0a0a0f] border-transparent shadow-lg cba-gold-glow'
                : 'neu-raised-sm border-white/5 hover:border-white/10',
            )}
          >
            <Calendar
              className={cn(
                'w-6 h-6',
                data.financialYearEnd === 'december' ? 'text-[#0a0a0f]' : 'text-zinc-500',
              )}
            />
            <div>
              <h4
                className={cn(
                  'font-bold text-sm',
                  data.financialYearEnd === 'december' ? 'text-[#0a0a0f]' : 'text-zinc-200',
                )}
              >
                31 December
              </h4>
              <p
                className={cn(
                  'text-xs',
                  data.financialYearEnd === 'december' ? 'text-[#0a0a0f]/70' : 'text-zinc-500',
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
        <div className="neu-inset rounded-2xl p-5 border border-[#FFCC00]/10 bg-[#FFCC00]/[0.02]">
          <p className="text-xs text-zinc-400 leading-relaxed">
            <span className="text-[#FFCC00] font-bold">For individuals:</span> GST and BAS settings
            don't apply to personal finances. We'll focus on tracking your income and deductible
            expenses for tax time.
          </p>
        </div>
      )}
    </div>
  );
}

export default TaxSetupStep;
