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
import { fetchPayCategories, createPayCategory, seedDefaultPayCategories } from '../../../../api';
import type { PayCategory, CategoryType, RateType } from './types';
import { TYPE_ORDER, TYPE_STYLES, RATE_SUFFIXES } from './constants';

function centsToDollars(cents: number | null): string {
  if (cents == null) return '-';
  return `$${(cents / 100).toFixed(2)}`;
}

export function PayCategoryManager() {
  const [categories, setCategories] = useState<PayCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<CategoryType>>(new Set(TYPE_ORDER));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ar3: consolidated form state
  const [form, setForm] = useState({
    name: '',
    type: 'ordinary' as CategoryType,
    rateType: 'hourly' as RateType,
    defaultRate: '',
    multiplier: '1.0',
    isTaxable: true,
    isSuperBearing: true,
  });

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
    setForm({
      name: '',
      type: 'ordinary',
      rateType: 'hourly',
      defaultRate: '',
      multiplier: '1.0',
      isTaxable: true,
      isSuperBearing: true,
    });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (cat: PayCategory) => {
    setForm({
      name: cat.name,
      type: cat.type,
      rateType: cat.rateType,
      defaultRate: cat.defaultRateCents != null ? (cat.defaultRateCents / 100).toFixed(2) : '',
      multiplier: cat.multiplier != null ? String(cat.multiplier) : '1.0',
      isTaxable: cat.isTaxable,
      isSuperBearing: cat.isSuperBearing,
    });
    setEditingId(cat.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    const rateCents = form.defaultRate ? Math.round(parseFloat(form.defaultRate) * 100) : null;
    const multiplier = parseFloat(form.multiplier) || 1.0;
    try {
      await createPayCategory({
        id: editingId ?? undefined,
        userId: 'default',
        name: form.name.trim(),
        type: form.type,
        rateType: form.rateType,
        defaultRateCents: rateCents,
        multiplier,
        isTaxable: form.isTaxable,
        isSuperBearing: form.isSuperBearing,
        isActive: true,
      });
      resetForm();
      await loadCategories();
    } catch {
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

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-4 w-32 bg-overlay rounded" />
            <div className="h-4 w-16 bg-overlay rounded" />
            <div className="h-4 w-20 bg-overlay rounded" />
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cba-gold text-black font-semibold text-sm hover:bg-cba-gold/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
        {categories.length === 0 && (
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-overlay border border-border text-primary text-sm hover:bg-overlay-hover transition-all disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4 text-cba-gold" />
            {seeding ? 'Seeding...' : 'Seed Default Categories'}
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="neu-raised rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">
              {editingId ? 'Edit Category' : 'New Pay Category'}
            </h3>
            <button onClick={resetForm} className="p-1 rounded-lg hover:bg-overlay text-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* A1: Name */}
            <div>
              <label htmlFor="cat-name" className="block text-xs font-medium text-secondary mb-1">
                Name
              </label>
              <input
                id="cat-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Base Hourly"
                className="w-full px-3 py-2 rounded-xl bg-overlay border border-border text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              />
            </div>
            {/* A1: Type */}
            <div>
              <label htmlFor="cat-type" className="block text-xs font-medium text-secondary mb-1">
                Type
              </label>
              <select
                id="cat-type"
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, type: e.target.value as CategoryType }))
                }
                className="w-full px-3 py-2 rounded-xl bg-overlay border border-border text-sm text-primary appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_STYLES[t].label}
                  </option>
                ))}
              </select>
            </div>
            {/* A1: Rate Type */}
            <div>
              <label
                htmlFor="cat-rate-type"
                className="block text-xs font-medium text-secondary mb-1"
              >
                Rate Type
              </label>
              <select
                id="cat-rate-type"
                value={form.rateType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, rateType: e.target.value as RateType }))
                }
                className="w-full px-3 py-2 rounded-xl bg-overlay border border-border text-sm text-primary appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              >
                <option value="hourly">Hourly</option>
                <option value="annual">Annual</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            {/* A1: Default Rate */}
            <div>
              <label
                htmlFor="cat-default-rate"
                className="block text-xs font-medium text-secondary mb-1"
              >
                Default Rate ($)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <input
                  id="cat-default-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.defaultRate}
                  onChange={(e) => setForm((prev) => ({ ...prev, defaultRate: e.target.value }))}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-overlay border border-border text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
              </div>
            </div>
            {/* A1: Multiplier (conditional) */}
            {form.type === 'overtime' && (
              <div>
                <label
                  htmlFor="cat-multiplier"
                  className="block text-xs font-medium text-secondary mb-1"
                >
                  Multiplier
                </label>
                <input
                  id="cat-multiplier"
                  type="number"
                  step="0.1"
                  min="1"
                  value={form.multiplier}
                  onChange={(e) => setForm((prev) => ({ ...prev, multiplier: e.target.value }))}
                  placeholder="1.5"
                  className="w-full px-3 py-2 rounded-xl bg-overlay border border-border text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <label htmlFor="paycat-f1" className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, isTaxable: !prev.isTaxable }))}
                className="text-secondary hover:text-primary"
              >
                {form.isTaxable ? (
                  <ToggleRight className="h-5 w-5 text-cba-gold" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
              <span className="text-xs text-primary">Taxable</span>
            </label>
            <label htmlFor="paycat-f2" className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, isSuperBearing: !prev.isSuperBearing }))
                }
                className="text-secondary hover:text-primary"
              >
                {form.isSuperBearing ? (
                  <ToggleRight className="h-5 w-5 text-cba-gold" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
              <span className="text-xs text-primary">Super Bearing</span>
            </label>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cba-gold text-black font-semibold text-sm hover:bg-cba-gold/90 transition-all"
            >
              <Check className="h-4 w-4" />
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-xl bg-overlay text-primary text-sm hover:bg-overlay-hover transition-all"
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
          <p className="text-secondary font-medium">No pay categories</p>
          <p className="text-xs text-muted mt-1">
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
                <button
                  onClick={() => toggleGroup(type)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-secondary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-secondary" />
                    )}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-xs text-muted">
                      {items.length} {items.length === 1 ? 'category' : 'categories'}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border/50">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2">
                            Name
                          </th>
                          <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2 hidden sm:table-cell">
                            Rate Type
                          </th>
                          <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2">
                            Default Rate
                          </th>
                          <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2 hidden md:table-cell">
                            Multiplier
                          </th>
                          <th className="text-center text-xs font-medium text-muted uppercase tracking-wider px-4 py-2 hidden lg:table-cell">
                            Taxable
                          </th>
                          <th className="text-center text-xs font-medium text-muted uppercase tracking-wider px-4 py-2 hidden lg:table-cell">
                            Super
                          </th>
                          <th className="text-right text-xs font-medium text-muted uppercase tracking-wider px-4 py-2">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((cat) => (
                          <tr
                            key={cat.id}
                            className={`border-b border-border/50 last:border-0 ${
                              !cat.isActive ? 'opacity-40' : ''
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <span className="text-sm text-primary font-medium">{cat.name}</span>
                            </td>
                            <td className="px-4 py-2.5 hidden sm:table-cell">
                              <span className="text-xs text-secondary bg-overlay px-2 py-0.5 rounded-md capitalize">
                                {cat.rateType}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-sm text-primary font-mono">
                                {centsToDollars(cat.defaultRateCents)}
                                {cat.defaultRateCents != null && (
                                  <span className="text-muted text-xs">
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
                                <Check className="h-4 w-4 text-cba-gold mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-zinc-600 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleToggleActive(cat)}
                                  title={cat.isActive ? 'Deactivate' : 'Activate'}
                                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-overlay transition-colors"
                                >
                                  {cat.isActive ? (
                                    <ToggleRight className="h-4 w-4 text-emerald-400" />
                                  ) : (
                                    <ToggleLeft className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleEdit(cat)}
                                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-overlay transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(cat.id)}
                                  className="p-1.5 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/5 transition-colors"
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
