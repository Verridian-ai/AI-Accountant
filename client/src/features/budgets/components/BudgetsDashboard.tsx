import { useState, useEffect } from 'react';
import { Wallet, Target, TrendingUp, Plus, BarChart3, Filter } from 'lucide-react';
import { budgetsApi } from '../../../api';
import type { Budget } from '../../../api';
import { BudgetEditor } from './BudgetEditor';
import { VarianceView } from './VarianceView';
import { ForecastScenarios } from './ForecastScenarios';
import { ScenarioComparison } from './ScenarioComparison';
import { CATEGORY_NAMES } from '../../transactions/constants/categories';

type Tab = 'budgets' | 'create' | 'forecasts';

const statusColors: Record<string, string> = {
    draft: 'text-zinc-400 bg-zinc-700/50',
    active: 'text-emerald-400 bg-emerald-500/20',
    closed: 'text-amber-400 bg-amber-500/20',
    archived: 'text-zinc-500 bg-zinc-800',
};

const typeLabels: Record<string, string> = {
    annual: 'Annual',
    quarterly: 'Quarterly',
    monthly: 'Monthly',
    project: 'Project',
};

export function BudgetsDashboard() {
    const [tab, setTab] = useState<Tab>('budgets');
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');

    // Sub-views
    const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
    const [viewingVarianceId, setViewingVarianceId] = useState<string | null>(null);
    const [comparisonIds, setComparisonIds] = useState<string[] | null>(null);

    // Create form
    const [createName, setCreateName] = useState('');
    const [createType, setCreateType] = useState<'annual' | 'quarterly' | 'monthly' | 'project'>('monthly');
    const [createStart, setCreateStart] = useState('');
    const [createEnd, setCreateEnd] = useState('');
    const [createAutoGenerate, setCreateAutoGenerate] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (tab === 'budgets') loadBudgets();
    }, [tab, statusFilter]);

    const loadBudgets = async () => {
        setLoading(true);
        try {
            const data = await budgetsApi.list(statusFilter || undefined);
            setBudgets(Array.isArray(data) ? data : data.budgets ?? []);
        } catch (e) {
            console.error('Failed to load budgets', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!createName || !createStart || !createEnd) return;
        setCreating(true);
        try {
            await budgetsApi.create({
                userId: 'default',
                name: createName,
                budgetType: createType,
                periodStart: createStart,
                periodEnd: createEnd,
                autoGenerate: createAutoGenerate,
            });
            setCreateName('');
            setCreateType('monthly');
            setCreateStart('');
            setCreateEnd('');
            setCreateAutoGenerate(false);
            setTab('budgets');
            loadBudgets();
        } catch (e) {
            console.error('Failed to create budget', e);
        } finally {
            setCreating(false);
        }
    };

    const fmt = (cents: number) =>
        '$' + (cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 });

    // Sub-view routing
    if (editingBudgetId) {
        return <BudgetEditor budgetId={editingBudgetId} onBack={() => setEditingBudgetId(null)} />;
    }
    if (viewingVarianceId) {
        return <VarianceView budgetId={viewingVarianceId} onBack={() => setViewingVarianceId(null)} />;
    }
    if (comparisonIds) {
        return (
            <div className="space-y-4">
                <button
                    onClick={() => setComparisonIds(null)}
                    className="text-sm text-zinc-400 hover:text-[#FFCC00] transition-colors"
                >
                    &larr; Back to Forecasts
                </button>
                <ScenarioComparison scenarioIds={comparisonIds} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Budgets & Forecasts</h2>
                <p className="text-sm text-zinc-500">
                    Plan, track, and forecast your financial performance
                </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 neu-inset p-1 rounded-xl w-fit">
                {([
                    { id: 'budgets' as Tab, label: 'My Budgets', icon: Wallet },
                    { id: 'create' as Tab, label: 'Create Budget', icon: Plus },
                    { id: 'forecasts' as Tab, label: 'Forecasts', icon: TrendingUp },
                ]).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            tab === t.id
                                ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_15px_rgba(255,204,0,0.15)]'
                                : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* My Budgets Tab */}
            {tab === 'budgets' && (
                <div className="space-y-4">
                    {/* Status Filter */}
                    <div className="flex items-center gap-3">
                        <Filter className="w-4 h-4 text-zinc-500" />
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-zinc-200 focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="closed">Closed</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    {/* Budget Cards */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="neu-raised rounded-2xl p-5 animate-pulse">
                                    <div className="h-5 bg-zinc-800 rounded w-2/3 mb-3" />
                                    <div className="h-4 bg-zinc-800 rounded w-1/2 mb-2" />
                                    <div className="h-4 bg-zinc-800 rounded w-1/3" />
                                </div>
                            ))}
                        </div>
                    ) : budgets.length === 0 ? (
                        <div className="neu-inset rounded-2xl p-8 text-center text-zinc-500">
                            <Wallet className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
                            <p>No budgets found.</p>
                            <p className="text-xs mt-1">Create a new budget to get started.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {budgets.map(b => (
                                <div
                                    key={b.id}
                                    className="neu-raised rounded-2xl p-5 hover:border-[#FFCC00]/20 border border-transparent transition-all group cursor-pointer"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <h4 className="text-sm font-bold text-zinc-200 group-hover:text-[#FFCC00] transition-colors truncate">
                                            {b.name}
                                        </h4>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColors[b.status] ?? statusColors.draft}`}>
                                            {b.status}
                                        </span>
                                    </div>

                                    <div className="space-y-1 mb-4">
                                        <p className="text-xs text-zinc-500">
                                            {typeLabels[b.budgetType] ?? b.budgetType} &middot; {b.periodStart} to {b.periodEnd}
                                        </p>
                                        {b.autoGenerated && (
                                            <span className="inline-block text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full font-medium">
                                                Auto-Generated
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <p className="text-lg font-bold text-[#FFCC00] font-mono">
                                            {fmt(b.totalAmount)}
                                        </p>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={e => { e.stopPropagation(); setEditingBudgetId(b.id); }}
                                                className="neu-raised-sm px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-[#FFCC00] transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); setViewingVarianceId(b.id); }}
                                                className="neu-raised-sm px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
                                            >
                                                <Target className="w-3 h-3" />
                                                Variance
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Create Budget Tab */}
            {tab === 'create' && (
                <div className="neu-raised rounded-2xl p-6 max-w-2xl space-y-5">
                    <h3 className="text-lg font-bold text-zinc-200">Create New Budget</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Budget Name</label>
                            <input
                                value={createName}
                                onChange={e => setCreateName(e.target.value)}
                                placeholder="e.g. Q1 2026 Operating Budget"
                                className="w-full neu-inset rounded-xl px-4 py-3 text-sm bg-transparent text-zinc-200 focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Budget Type</label>
                                <select
                                    value={createType}
                                    onChange={e => setCreateType(e.target.value as any)}
                                    className="w-full neu-inset rounded-xl px-3 py-3 text-sm bg-transparent text-zinc-200 focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
                                >
                                    <option value="annual">Annual</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="project">Project</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Period Start</label>
                                <input
                                    type="date"
                                    value={createStart}
                                    onChange={e => setCreateStart(e.target.value)}
                                    className="w-full neu-inset rounded-xl px-3 py-3 text-sm bg-transparent text-zinc-200 focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Period End</label>
                                <input
                                    type="date"
                                    value={createEnd}
                                    onChange={e => setCreateEnd(e.target.value)}
                                    className="w-full neu-inset rounded-xl px-3 py-3 text-sm bg-transparent text-zinc-200 focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
                                />
                            </div>
                        </div>

                        {/* Auto-Generate Toggle */}
                        <div className="flex items-center gap-3 neu-inset rounded-xl px-4 py-3">
                            <button
                                onClick={() => setCreateAutoGenerate(!createAutoGenerate)}
                                className={`w-10 h-6 rounded-full transition-colors relative ${
                                    createAutoGenerate ? 'bg-[#FFCC00]' : 'bg-zinc-700'
                                }`}
                            >
                                <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                        createAutoGenerate ? 'translate-x-5' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                            <div>
                                <p className="text-sm font-medium text-zinc-200">Auto-Generate from History</p>
                                <p className="text-xs text-zinc-500">
                                    AI will analyze your past transactions to pre-fill budget lines
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setTab('budgets')}
                                className="px-4 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!createName || !createStart || !createEnd || creating}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 transition-colors disabled:opacity-40"
                            >
                                {creating ? 'Creating...' : 'Create Budget'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Forecasts Tab */}
            {tab === 'forecasts' && (
                <ForecastScenarios onCompare={(ids) => setComparisonIds(ids)} />
            )}
        </div>
    );
}
