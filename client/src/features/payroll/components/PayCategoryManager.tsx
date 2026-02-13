import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronRight,
  DollarSign,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { fetchPayCategories, createPayCategory, seedDefaultPayCategories } from '../../../api';

// ── Types ────────────────────────────────────────────────────────────

type CategoryType = 'ordinary' | 'overtime' | 'allowance' | 'deduction' | 'super' | 'leave';
type RateType = 'hourly' | 'annual' | 'fixed';

interface PayCategory {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  rateType: RateType;
  defaultRateCents: number | null;
  multiplier: number | null;
  isTaxable: boolean;
  isSuperBearing: boolean;
  isActive: boolean;
  createdAt: string;
}

// ── Constants ────────────────────────────────────────────────────────

const TYPE_ORDER: CategoryType[] = [
  'ordinary',
  'overtime',
  'allowance',
  'deduction',
  'super',
  'leave',
];

const TYPE_STYLES: Record<CategoryType, { bg: string; text: string; label: string }> = {
  ordinary: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Ordinary' },
  overtime: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Overtime' },
  allowance: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Allowance' },
  deduction: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Deduction' },
  super: { bg: 'bg-[#FFCC00]/10', text: 'text-[#FFCC00]', label: 'Super' },
  leave: { bg: 'bg-teal-500/10', text: 'text-teal-400', label: 'Leave' },
};

const RATE_SUFFIXES: Record<RateType, string> = {
  hourly: '/hr',
  annual: '/year',
  fixed: '',
};

// ── Helpers ──────────────────────────────────────────────────────────

function centsToDollars(cents: number | null): string {
  if (cents == null) return '-';
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Component ────────────────────────────────────────────────────────

export function PayCategoryManager() {
  const [categories, setCategories] = useState<PayCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<CategoryType>>(new Set(TYPE_ORDER));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<CategoryType>('ordinary');
  const [formRateType, setFormRateType] = useState<RateType>('hourly');
  const [formDefaultRate, setFormDefaultRate] = useState('');
  const [formMultiplier, setFormMultiplier] = useState('1.0');
  const [formIsTaxable, setFormIsTaxable] = useState(true);
  const [formIsSuperBearing, setFormIsSuperBearing] = useState(true);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const result = await fetchPayCategories('default');
      setCategories(result.data ?? []);
    } catch (e) {
      console.error('Failed to fetch pay categories', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<CategoryType, PayCategory[]>();
    for (const t of TYPE_ORDER) map.set(t, []);
    for (const cat of categories) {
      const arr = map.get(cat.type);
      if (arr) arr.push(cat);
    }
    return map;
  }, [categories]);

  const toggleGroup = (type: CategoryType) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const resetForm = () => {
    setFormName('');
    setFormType('ordinary');
    setFormRateType('hourly');
    setFormDefaultRate('');
    setFormMultiplier('1.0');
    setFormIsTaxable(true);
    setFormIsSuperBearing(true);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (cat: PayCategory) => {
    setFormName(cat.name);
    setFormType(cat.type);
    setFormRateType(cat.rateType);
    setFormDefaultRate(cat.defaultRateCents != null ? (cat.defaultRateCents / 100).toFixed(2) : '');
    setFormMultiplier(cat.multiplier != null ? String(cat.multiplier) : '1.0');
    setFormIsTaxable(cat.isTaxable);
    setFormIsSuperBearing(cat.isSuperBearing);
    setEditingId(cat.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);

    const rateCents = formDefaultRate ? Math.round(parseFloat(formDefaultRate) * 100) : null;
    const multiplier = parseFloat(formMultiplier) || 1.0;

    try {
      await createPayCategory({
        id: editingId ?? undefined,
        userId: 'default',
        name: formName.trim(),
        type: formType,
        rateType: formRateType,
        defaultRateCents: rateCents,
        multiplier,
        isTaxable: formIsTaxable,
        isSuperBearing: formIsSuperBearing,
        isActive: true,
      });
      resetForm();
      await loadCategories();
    } catch (e) {
      setError('Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await createPayCategory({ id, isActive: false });
      await loadCategories();
    } catch (e) {
      console.error('Failed to delete category', e);
    }
  };

  const handleToggleActive = async (cat: PayCategory) => {
    try {
      await createPayCategory({ id: cat.id, isActive: !cat.isActive });
      await loadCategories();
    } catch (e) {
      console.error('Failed to toggle category', e);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      await seedDefaultPayCategories('default');
      await loadCategories();
    } catch (e) {
      console.error('Failed to seed defaults', e);
    } finally {
      setSeeding(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-4 w-32 bg-white/5 rounded" />
            <div className="h-4 w-16 bg-white/5 rounded" />
            <div className="h-4 w-20 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFCC00] text-black font-semibold text-sm hover:bg-[#FFCC00]/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
        {categories.length === 0 && (
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-sm hover:bg-white/10 transition-all disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4 text-[#FFCC00]" />
            {seeding ? 'Seeding...' : 'Seed Default Categories'}
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="neu-raised rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {editingId ? 'Edit Category' : 'New Pay Category'}
            </h3>
            <button onClick={resetForm} className="p-1 rounded-lg hover:bg-white/5 text-zinc-400">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Base Hourly"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as CategoryType)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_STYLES[t].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rate Type */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Rate Type</label>
              <select
                value={formRateType}
                onChange={(e) => setFormRateType(e.target.value as RateType)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              >
                <option value="hourly">Hourly</option>
                <option value="annual">Annual</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>

            {/* Default Rate */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Default Rate ($)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formDefaultRate}
                  onChange={(e) => setFormDefaultRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
              </div>
            </div>

            {/* Multiplier */}
            {formType === 'overtime' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={formMultiplier}
                  onChange={(e) => setFormMultiplier(e.target.value)}
                  placeholder="1.5"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setFormIsTaxable(!formIsTaxable)}
                className="text-zinc-400 hover:text-white"
              >
                {formIsTaxable ? (
                  <ToggleRight className="h-5 w-5 text-[#FFCC00]" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
              <span className="text-xs text-zinc-300">Taxable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setFormIsSuperBearing(!formIsSuperBearing)}
                className="text-zinc-400 hover:text-white"
              >
                {formIsSuperBearing ? (
                  <ToggleRight className="h-5 w-5 text-[#FFCC00]" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
              <span className="text-xs text-zinc-300">Super Bearing</span>
            </label>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Submit */}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFCC00] text-black font-semibold text-sm hover:bg-[#FFCC00]/90 transition-all"
            >
              <Check className="h-4 w-4" />
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-sm hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Grouped Category List */}
      {categories.length === 0 && !showForm ? (
        <div className="neu-raised rounded-2xl p-8 text-center">
          <DollarSign className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No pay categories</p>
          <p className="text-xs text-zinc-500 mt-1">
            Create categories or seed default Australian pay categories to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {TYPE_ORDER.map((type) => {
            const items = grouped.get(type) ?? [];
            if (items.length === 0) return null;
            const style = TYPE_STYLES[type];
            const isExpanded = expandedGroups.has(type);

            return (
              <div key={type} className="neu-raised rounded-2xl overflow-hidden">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(type)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    )}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {items.length} {items.length === 1 ? 'category' : 'categories'}
                    </span>
                  </div>
                </button>

                {/* Items */}
                {isExpanded && (
                  <div className="border-t border-white/5">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                            Name
                          </th>
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2 hidden sm:table-cell">
                            Rate Type
                          </th>
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                            Default Rate
                          </th>
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2 hidden md:table-cell">
                            Multiplier
                          </th>
                          <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2 hidden lg:table-cell">
                            Taxable
                          </th>
                          <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2 hidden lg:table-cell">
                            Super
                          </th>
                          <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-2">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((cat) => (
                          <tr
                            key={cat.id}
                            className={`border-b border-white/5 last:border-0 ${
                              !cat.isActive ? 'opacity-40' : ''
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <span className="text-sm text-white font-medium">{cat.name}</span>
                            </td>
                            <td className="px-4 py-2.5 hidden sm:table-cell">
                              <span className="text-xs text-zinc-400 bg-white/5 px-2 py-0.5 rounded-md capitalize">
                                {cat.rateType}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-sm text-zinc-300 font-mono">
                                {centsToDollars(cat.defaultRateCents)}
                                {cat.defaultRateCents != null && (
                                  <span className="text-zinc-500 text-xs">
                                    {RATE_SUFFIXES[cat.rateType]}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 hidden md:table-cell">
                              {cat.type === 'overtime' && cat.multiplier != null ? (
                                <span className="text-sm text-purple-400 font-semibold">
                                  {cat.multiplier}x
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-600">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center hidden lg:table-cell">
                              {cat.isTaxable ? (
                                <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-zinc-600 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center hidden lg:table-cell">
                              {cat.isSuperBearing ? (
                                <Check className="h-4 w-4 text-[#FFCC00] mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-zinc-600 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleToggleActive(cat)}
                                  title={cat.isActive ? 'Deactivate' : 'Activate'}
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                  {cat.isActive ? (
                                    <ToggleRight className="h-4 w-4 text-emerald-400" />
                                  ) : (
                                    <ToggleLeft className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleEdit(cat)}
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(cat.id)}
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
