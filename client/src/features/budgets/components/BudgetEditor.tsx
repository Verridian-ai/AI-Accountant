import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Sparkles, ChevronRight } from 'lucide-react';
import { budgetsApi } from '../../../api';
import type { Budget, BudgetLine } from '../../../api';
import { CATEGORY_NAMES } from '../../transactions/constants/categories';

interface BudgetEditorProps {
  budgetId: string;
  onBack: () => void;
}

export function BudgetEditor({ budgetId, onBack }: BudgetEditorProps) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // New line form
  const [newCategory, setNewCategory] = useState('');
  const [newPeriod, setNewPeriod] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const loadBudget = useCallback(async () => {
    setLoading(true);
    try {
      const data = await budgetsApi.get(budgetId);
      setBudget(data.budget ?? data);
      setLines(data.lines ?? []);
    } catch (e) {
      console.error('Failed to load budget', e);
    } finally {
      setLoading(false);
    }
  }, [budgetId]);

  useEffect(() => {
    loadBudget();
  }, [loadBudget]);

  const handleAddLine = async () => {
    if (!newCategory || !newAmount) return;
    try {
      const result = await budgetsApi.addLine(budgetId, {
        category: newCategory,
        period: newPeriod || budget?.periodStart || '',
        budgetedAmount: parseFloat(newAmount) * 100,
        notes: newNotes || undefined,
      });
      setLines((prev) => [...prev, result]);
      setNewCategory('');
      setNewPeriod('');
      setNewAmount('');
      setNewNotes('');
      loadBudget();
    } catch (e) {
      console.error('Failed to add line', e);
    }
  };

  const handleSaveCell = async (lineId: string, field: string) => {
    const value = field === 'budgetedAmount' ? parseFloat(editValue) * 100 : editValue;
    try {
      await budgetsApi.update(budgetId, {
        lineUpdate: { lineId, [field]: value },
      });
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, [field]: value } : l)));
    } catch (e) {
      console.error('Failed to save cell', e);
    }
    setEditingCell(null);
  };

  const handleStatusChange = async (newStatus: 'draft' | 'active' | 'closed') => {
    setSaving(true);
    try {
      await budgetsApi.update(budgetId, { status: newStatus });
      setBudget((prev: Budget | null) => (prev ? { ...prev, status: newStatus } : prev));
    } catch (e) {
      console.error('Failed to update status', e);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGenerate = async () => {
    setSaving(true);
    try {
      await budgetsApi.update(budgetId, { autoGenerate: true });
      await loadBudget();
    } catch (e) {
      console.error('Failed to auto-generate', e);
    } finally {
      setSaving(false);
    }
  };

  const totalBudgeted = lines.reduce((sum, l) => sum + (l.budgetedAmount ?? 0), 0);

  const statusFlow: Array<'draft' | 'active' | 'closed'> = ['draft', 'active', 'closed'];
  const _currentIndex = statusFlow.indexOf(budget?.status as 'draft' | 'active' | 'closed');

  if (loading) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-secondary hover:text-cba-gold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Budgets
        </button>
        <div className="neu-raised rounded-2xl p-8 animate-pulse">
          <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4" />
          <div className="h-4 bg-zinc-800 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-secondary hover:text-cba-gold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Budgets
        </button>
        <div className="neu-raised rounded-2xl p-8 text-center text-muted">Budget not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="neu-raised-sm p-2 rounded-xl text-secondary hover:text-cba-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gradient-gold">{budget.name}</h2>
            <p className="text-sm text-muted">
              {budget.budgetType} &middot; {budget.periodStart} to {budget.periodEnd}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoGenerate}
            disabled={saving}
            className="neu-raised-sm px-3 py-2 rounded-xl text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Generate
          </button>

          {/* Status Controls */}
          <div className="flex items-center gap-1 neu-inset px-2 py-1 rounded-xl">
            {statusFlow.map((s, i) => (
              <span key={s} className="flex items-center">
                <button
                  onClick={() => handleStatusChange(s)}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    budget.status === s
                      ? s === 'draft'
                        ? 'bg-zinc-700 text-primary'
                        : s === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      : 'text-zinc-600 hover:text-secondary'
                  }`}
                >
                  {s}
                </button>
                {i < statusFlow.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-zinc-600 mx-0.5" />
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Add New Line */}
      <div className="neu-raised rounded-2xl p-4">
        <h3 className="text-sm font-bold text-primary mb-3">Add Budget Line</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
          >
            <option value="">Select Category</option>
            {CATEGORY_NAMES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="month"
            value={newPeriod}
            onChange={(e) => setNewPeriod(e.target.value)}
            placeholder="Period"
            className="neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
          />
          <input
            type="number"
            step="0.01"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="Amount ($)"
            className="neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
          />
          <input
            type="text"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes"
            className="neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
          />
          <button
            onClick={handleAddLine}
            disabled={!newCategory || !newAmount}
            className="neu-raised-sm px-4 py-2 rounded-xl text-sm font-bold text-cba-gold hover:bg-cba-gold/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Lines Table */}
      <div className="neu-raised rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-4 py-3 text-muted font-bold uppercase text-xs tracking-wider">
                  Category
                </th>
                <th className="text-left px-4 py-3 text-muted font-bold uppercase text-xs tracking-wider">
                  Period
                </th>
                <th className="text-right px-4 py-3 text-muted font-bold uppercase text-xs tracking-wider">
                  Budgeted
                </th>
                <th className="text-left px-4 py-3 text-muted font-bold uppercase text-xs tracking-wider">
                  Notes
                </th>
                <th className="text-center px-4 py-3 text-muted font-bold uppercase text-xs tracking-wider w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={line.id}
                  className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3 text-primary font-medium">{line.category}</td>
                  <td className="px-4 py-3 text-secondary">{line.period}</td>
                  <td className="px-4 py-3 text-right">
                    {editingCell === `${line.id}-amount` ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveCell(line.id, 'budgetedAmount')}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && handleSaveCell(line.id, 'budgetedAmount')
                        }
                        className="neu-inset rounded-lg px-2 py-1 text-sm bg-transparent text-primary w-28 text-right focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingCell(`${line.id}-amount`);
                          setEditValue(((line.budgetedAmount ?? 0) / 100).toFixed(2));
                        }}
                        className="text-cba-gold font-mono hover:underline"
                      >
                        $
                        {((line.budgetedAmount ?? 0) / 100).toLocaleString('en-AU', {
                          minimumFractionDigits: 2,
                        })}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{line.notes || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button className="text-red-400/60 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">
                    No budget lines yet. Add one above or use Auto-Generate.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-cba-gold/20 bg-cba-gold/5">
                <td colSpan={2} className="px-4 py-3 text-primary font-bold">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-cba-gold font-bold font-mono">
                  ${(totalBudgeted / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
