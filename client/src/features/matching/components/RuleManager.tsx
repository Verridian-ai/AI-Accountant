import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { matchesApi } from '@/api';
import type { PaymentMatchRule } from '@/api';

const LOADING_RULE_ROWS = [0, 1, 2] as const;

const RULE_TYPES = [
  { value: 'exact_amount', label: 'Exact Amount' },
  { value: 'amount_range', label: 'Amount Range' },
  { value: 'vendor_match', label: 'Vendor Match' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'composite', label: 'Composite' },
] as const;

const RULE_TYPE_COLORS: Record<string, string> = {
  exact_amount: 'bg-blue-400/20 text-blue-400',
  amount_range: 'bg-purple-400/20 text-purple-400',
  vendor_match: 'bg-emerald-400/20 text-emerald-400',
  recurring: 'bg-amber-400/20 text-amber-400',
  composite: 'bg-[#FFCC00]/20 text-[#FFCC00]',
};

interface NewRuleForm {
  name: string;
  ruleType: PaymentMatchRule['ruleType'];
  vendorPattern: string;
  amountExact: string;
  amountMin: string;
  amountMax: string;
  amountTolerance: string;
  dateToleranceDays: string;
  categoryFilter: string;
  priority: string;
}

const DEFAULT_FORM: NewRuleForm = {
  name: '',
  ruleType: 'exact_amount',
  vendorPattern: '',
  amountExact: '',
  amountMin: '',
  amountMax: '',
  amountTolerance: '0.01',
  dateToleranceDays: '3',
  categoryFilter: '',
  priority: '10',
};

export function RuleManager() {
  const [rules, setRules] = useState<PaymentMatchRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewRuleForm>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await matchesApi.listRules();
      setRules(data);
    } catch (e) {
      console.error('Failed to load rules', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await matchesApi.createRule({
        name: form.name.trim(),
        ruleType: form.ruleType,
        vendorPattern: form.vendorPattern || undefined,
        amountExact: form.amountExact ? parseFloat(form.amountExact) : undefined,
        amountMin: form.amountMin ? parseFloat(form.amountMin) : undefined,
        amountMax: form.amountMax ? parseFloat(form.amountMax) : undefined,
        amountTolerance: parseFloat(form.amountTolerance) || 0.01,
        dateToleranceDays: parseInt(form.dateToleranceDays) || 3,
        categoryFilter: form.categoryFilter || undefined,
        priority: parseInt(form.priority) || 10,
      });
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await loadRules();
    } catch (e) {
      console.error('Failed to create rule', e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await matchesApi.deleteRule(ruleId);
      setDeleteConfirm(null);
      await loadRules();
    } catch (e) {
      console.error('Failed to delete rule', e);
    }
  };

  const updateField = <K extends keyof NewRuleForm>(field: K, value: NewRuleForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const showVendor = form.ruleType === 'vendor_match' || form.ruleType === 'composite';
  const showExact = form.ruleType === 'exact_amount' || form.ruleType === 'composite';
  const showRange = form.ruleType === 'amount_range' || form.ruleType === 'composite';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="neu-inset p-2 rounded-lg">
            <Settings className="h-4 w-4 text-[#FFCC00]" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">Matching Rules ({rules.length})</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 neu-raised rounded-lg text-sm font-medium text-[#FFCC00] hover:bg-white/5 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Rule
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="neu-raised rounded-xl p-6 border border-[#FFCC00]/20 space-y-4">
          <h4 className="text-sm font-semibold text-[#FFCC00]">New Matching Rule</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rm-rule-name" className="block text-xs text-zinc-400 mb-1">
                Rule Name
              </label>
              <input
                id="rm-rule-name"
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Monthly Rent Payment"
                className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
              />
            </div>
            <div>
              <label htmlFor="rm-rule-type" className="block text-xs text-zinc-400 mb-1">
                Rule Type
              </label>
              <select
                id="rm-rule-type"
                value={form.ruleType}
                onChange={(e) =>
                  updateField('ruleType', e.target.value as PaymentMatchRule['ruleType'])
                }
                className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
              >
                {RULE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showVendor && (
            <div>
              <label htmlFor="rm-vendor-pattern" className="block text-xs text-zinc-400 mb-1">
                Vendor Pattern (supports wildcards *)
              </label>
              <input
                id="rm-vendor-pattern"
                type="text"
                value={form.vendorPattern}
                onChange={(e) => updateField('vendorPattern', e.target.value)}
                placeholder="e.g. *ELECTRICITY* or Telstra*"
                className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
              />
            </div>
          )}

          {showExact && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rm-amount-exact" className="block text-xs text-zinc-400 mb-1">
                  Exact Amount ($)
                </label>
                <input
                  id="rm-amount-exact"
                  type="number"
                  step="0.01"
                  value={form.amountExact}
                  onChange={(e) => updateField('amountExact', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
                />
              </div>
              <div>
                <label htmlFor="rm-amount-tolerance" className="block text-xs text-zinc-400 mb-1">
                  Amount Tolerance ($)
                </label>
                <input
                  id="rm-amount-tolerance"
                  type="number"
                  step="0.01"
                  value={form.amountTolerance}
                  onChange={(e) => updateField('amountTolerance', e.target.value)}
                  placeholder="0.01"
                  className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
                />
              </div>
            </div>
          )}

          {showRange && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rm-amount-min" className="block text-xs text-zinc-400 mb-1">
                  Min Amount ($)
                </label>
                <input
                  id="rm-amount-min"
                  type="number"
                  step="0.01"
                  value={form.amountMin}
                  onChange={(e) => updateField('amountMin', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
                />
              </div>
              <div>
                <label htmlFor="rm-amount-max" className="block text-xs text-zinc-400 mb-1">
                  Max Amount ($)
                </label>
                <input
                  id="rm-amount-max"
                  type="number"
                  step="0.01"
                  value={form.amountMax}
                  onChange={(e) => updateField('amountMax', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="rm-date-tolerance" className="block text-xs text-zinc-400 mb-1">
                Date Tolerance (days)
              </label>
              <input
                id="rm-date-tolerance"
                type="number"
                min="0"
                max="90"
                value={form.dateToleranceDays}
                onChange={(e) => updateField('dateToleranceDays', e.target.value)}
                className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
              />
            </div>
            <div>
              <label htmlFor="rm-category-filter" className="block text-xs text-zinc-400 mb-1">
                Category Filter
              </label>
              <input
                id="rm-category-filter"
                type="text"
                value={form.categoryFilter}
                onChange={(e) => updateField('categoryFilter', e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
              />
            </div>
            <div>
              <label htmlFor="rm-priority" className="block text-xs text-zinc-400 mb-1">
                Priority (lower = higher)
              </label>
              <input
                id="rm-priority"
                type="number"
                min="1"
                max="100"
                value={form.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                className="w-full px-3 py-2 neu-inset rounded-lg bg-transparent text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={creating || !form.name.trim()}
              className="px-5 py-2 rounded-lg bg-[#FFCC00] text-[#0a0a0f] text-sm font-bold hover:bg-[#FFD633] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating...' : 'Create Rule'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(DEFAULT_FORM);
              }}
              className="px-4 py-2 rounded-lg text-zinc-400 text-sm hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      {loading ? (
        <div className="space-y-3">
          {LOADING_RULE_ROWS.map((i) => (
            <div key={i} className="neu-raised rounded-xl p-5 animate-pulse">
              <div className="h-5 w-48 bg-zinc-700 rounded mb-2" />
              <div className="h-3 w-32 bg-zinc-700 rounded" />
            </div>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="neu-raised rounded-xl p-8 text-center">
          <Settings className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No matching rules configured</p>
          <p className="text-xs text-zinc-500 mt-1">Create a rule to automate payment matching</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const isExpanded = expandedId === rule.id;
            const isRecent =
              rule.lastMatchedAt &&
              Date.now() - new Date(rule.lastMatchedAt).getTime() < 7 * 24 * 60 * 60 * 1000;

            return (
              <div
                key={rule.id}
                className={`neu-raised rounded-xl overflow-hidden ${!rule.isActive ? 'opacity-60' : ''}`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-zinc-200 truncate">{rule.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${RULE_TYPE_COLORS[rule.ruleType] ?? 'bg-zinc-700 text-zinc-300'}`}
                    >
                      {rule.ruleType.replace('_', ' ')}
                    </span>
                    {rule.matchCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 text-[10px] font-bold">
                        {rule.matchCount} matches
                      </span>
                    )}
                    <span
                      className={`w-2 h-2 rounded-full ${isRecent ? 'bg-emerald-400' : rule.matchCount > 0 ? 'bg-zinc-600' : 'bg-zinc-700'}`}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-500 font-mono">P{rule.priority}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 pt-0 border-t border-white/5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3 text-sm">
                      {rule.vendorPattern && (
                        <div>
                          <span className="text-xs text-zinc-500">Vendor Pattern</span>
                          <p className="text-zinc-300 font-mono text-xs mt-0.5">
                            {rule.vendorPattern}
                          </p>
                        </div>
                      )}
                      {rule.amountExact != null && (
                        <div>
                          <span className="text-xs text-zinc-500">Exact Amount</span>
                          <p className="text-zinc-300 font-mono text-xs mt-0.5">
                            ${rule.amountExact.toFixed(2)}
                          </p>
                        </div>
                      )}
                      {rule.amountMin != null && (
                        <div>
                          <span className="text-xs text-zinc-500">Amount Range</span>
                          <p className="text-zinc-300 font-mono text-xs mt-0.5">
                            ${rule.amountMin.toFixed(2)} - ${(rule.amountMax ?? 0).toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-xs text-zinc-500">Amount Tolerance</span>
                        <p className="text-zinc-300 font-mono text-xs mt-0.5">
                          ${rule.amountTolerance.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500">Date Tolerance</span>
                        <p className="text-zinc-300 text-xs mt-0.5">
                          {rule.dateToleranceDays} days
                        </p>
                      </div>
                      {rule.categoryFilter && (
                        <div>
                          <span className="text-xs text-zinc-500">Category</span>
                          <p className="text-zinc-300 text-xs mt-0.5">{rule.categoryFilter}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-xs text-zinc-500">Last Matched</span>
                        <p className="text-zinc-300 text-xs mt-0.5">
                          {rule.lastMatchedAt
                            ? new Date(rule.lastMatchedAt).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      {deleteConfirm === rule.id ? (
                        <>
                          <span className="text-xs text-red-400">Delete this rule?</span>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1.5 rounded-lg text-zinc-400 text-xs hover:text-zinc-200"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(rule.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-400/70 text-xs hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
