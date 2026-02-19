import { useState } from 'react';
import {
  Building2,
  Briefcase,
  Users,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantApi } from '@/api';
import { PlanComparison } from '../../subscription/components/PlanComparison';

const ENTITY_TYPES = [
  {
    value: 'sole_trader',
    label: 'Sole Trader',
    icon: Briefcase,
    desc: 'Individual operating a business',
  },
  { value: 'company', label: 'Company', icon: Building2, desc: 'Pty Ltd or Ltd entity' },
  { value: 'trust', label: 'Trust', icon: Users, desc: 'Family, unit or discretionary trust' },
  { value: 'partnership', label: 'Partnership', icon: Users, desc: 'Two or more partners' },
  { value: 'smsf', label: 'SMSF', icon: DollarSign, desc: 'Self-managed super fund' },
];

const STEPS = ['Business Details', 'Entity Type', 'Select Plan', 'Confirm'];

export function TenantCreate() {
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    abn: '',
    entityType: '',
    planId: 'starter',
  });

  const autoSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const canAdvance = () => {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 1) return form.entityType.length > 0;
    if (step === 2) return form.planId.length > 0;
    return true;
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await tenantApi.createTenant({
        name: form.name,
        slug: form.slug || autoSlug(form.name),
        abn: form.abn || undefined,
        entityType: form.entityType,
        planId: form.planId,
      });
      if (result.id) {
        localStorage.setItem('tenantId', result.id);
      }
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  if (done) {
    return (
      <div className="neu-raised rounded-2xl p-12 text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100">Workspace Created!</h2>
        <p className="text-sm text-zinc-400">
          Your workspace <span className="text-[#FFCC00] font-bold">{form.name}</span> is ready.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633] transition-colors"
        >
          Go to Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Create Workspace</h2>
        <p className="text-sm text-zinc-500 mt-1">Set up a new workspace for your business</p>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-3">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex items-center gap-2 transition-all',
                i <= step ? 'text-[#FFCC00]' : 'text-zinc-600',
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all',
                  i < step
                    ? 'bg-[#FFCC00] text-[#0a0a0f]'
                    : i === step
                      ? 'bg-[#FFCC00]/20 text-[#FFCC00] ring-2 ring-[#FFCC00]/50'
                      : 'bg-zinc-800 text-zinc-500',
                )}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className="hidden sm:block text-xs font-bold">{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={cn('w-8 h-0.5 rounded-full', i < step ? 'bg-[#FFCC00]' : 'bg-zinc-800')}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="neu-raised rounded-2xl border border-white/5 p-6 animate-in fade-in duration-300">
        {step === 0 && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold text-zinc-100">Business Details</h3>
            <div>
              <label htmlFor="tenant-name" className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                Business Name
              </label>
              <input
                id="tenant-name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) })
                }
                placeholder="My Business Pty Ltd"
                className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30 placeholder:text-zinc-600"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="tenant-slug" className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                Workspace URL
              </label>
              <div className="flex items-center neu-inset rounded-xl">
                <span className="text-sm text-zinc-500 pl-3">goldledger.app/</span>
                <input
                  id="tenant-slug"
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="flex-1 px-1 py-2.5 text-sm text-zinc-200 bg-transparent outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="tenant-abn" className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                ABN (optional)
              </label>
              <input
                id="tenant-abn"
                type="text"
                value={form.abn}
                onChange={(e) => setForm({ ...form, abn: e.target.value })}
                placeholder="XX XXX XXX XXX"
                className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30 placeholder:text-zinc-600"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold text-zinc-100">Entity Type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ENTITY_TYPES.map((et) => {
                const Icon = et.icon;
                const selected = form.entityType === et.value;
                return (
                  <button
                    key={et.value}
                    type="button"
                    onClick={() => setForm({ ...form, entityType: et.value })}
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                      selected
                        ? 'border-[#FFCC00]/50 bg-[#FFCC00]/5 shadow-[0_0_20px_rgba(255,204,0,0.08)]'
                        : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]',
                    )}
                  >
                    <div
                      className={cn(
                        'neu-inset p-2 rounded-xl shrink-0',
                        selected ? 'text-[#FFCC00]' : 'text-zinc-500',
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={cn('font-bold', selected ? 'text-[#FFCC00]' : 'text-zinc-200')}>
                        {et.label}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{et.desc}</p>
                    </div>
                    {selected && <Check className="w-5 h-5 text-[#FFCC00] shrink-0 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-zinc-100">Choose Your Plan</h3>
            <PlanComparison
              currentPlan=""
              selectedPlan={form.planId}
              onSelectPlan={(planId) => setForm({ ...form, planId })}
              isOnboarding
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 text-center">
            <h3 className="text-lg font-bold text-zinc-100">Confirm & Create</h3>
            <div className="neu-inset rounded-xl p-5 text-left space-y-3 max-w-sm mx-auto">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Name</span>
                <span className="text-zinc-200 font-bold">{form.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Type</span>
                <span className="text-zinc-200 font-bold">
                  {form.entityType.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Plan</span>
                <span className="text-[#FFCC00] font-bold">
                  {form.planId.charAt(0).toUpperCase() + form.planId.slice(1)}
                </span>
              </div>
              {form.abn && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">ABN</span>
                  <span className="text-zinc-200 font-bold">{form.abn}</span>
                </div>
              )}
            </div>
            {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633] transition-colors disabled:opacity-50"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633] transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Workspace'}
          </button>
        )}
      </div>
    </div>
  );
}
