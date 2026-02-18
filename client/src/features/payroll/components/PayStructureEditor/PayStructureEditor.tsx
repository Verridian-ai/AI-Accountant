import { Plus, Check, X, History, DollarSign, Calculator, ArrowLeft } from 'lucide-react';
import { SUPER_RATE, TYPE_STYLES } from './constants.js';
import { centsToDollars } from './helpers.js';
import { usePayStructure } from './hooks/usePayStructure.js';
import type { PayStructureEditorProps, CategoryType } from './types.js';

export function PayStructureEditor({ employeeId, onBack }: PayStructureEditorProps) {
  const {
    employee,
    categories,
    displayItems,
    loading,
    showHistory,
    setShowHistory,
    showForm,
    setShowForm,
    saving,
    formCategoryId,
    formRate,
    formHoursPerWeek,
    formAnnualSalary,
    formEffectiveDate,
    setFormRate,
    setFormHoursPerWeek,
    setFormAnnualSalary,
    setFormEffectiveDate,
    selectedCategory,
    summary,
    resetForm,
    handleCategoryChange,
    handleAddPayItem,
  } = usePayStructure(employeeId);

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-6 space-y-4">
        <div className="h-6 w-48 bg-white/5 rounded animate-pulse" />
        <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
        <div className="space-y-3 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">
            {employee ? `${employee.first_name} ${employee.last_name}` : 'Employee'} — Pay Structure
          </h3>
          {employee && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {employee.employment_type?.replace('_', ' ')} &middot;{' '}
              {employee.position ?? 'No position'}
            </p>
          )}
        </div>
      </div>

      {/* Pay Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Weekly', value: summary.weekly },
          { label: 'Fortnightly', value: summary.fortnightly },
          { label: 'Monthly', value: summary.monthly },
          { label: 'Annual', value: summary.annual },
          {
            label: `Super (${(SUPER_RATE * 100).toFixed(1)}%)`,
            value: summary.superAnnual,
            accent: true,
          },
        ].map((card) => (
          <div key={card.label} className="neu-raised rounded-xl p-3">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
              {card.label}
            </p>
            <p
              className={`text-lg font-bold mt-0.5 font-mono ${card.accent ? 'text-[#FFCC00]' : 'text-white'}`}
            >
              $
              {card.value.toLocaleString('en-AU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFCC00] text-black font-semibold text-sm hover:bg-[#FFCC00]/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
        >
          <Plus className="h-4 w-4" />
          Add Pay Item
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${
            showHistory
              ? 'bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/20'
              : 'bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10'
          }`}
        >
          <History className="h-4 w-4" />
          {showHistory ? 'Current Only' : 'Show History'}
        </button>
      </div>

      {/* Add Pay Item Form */}
      {showForm && (
        <div className="neu-raised rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">New Pay Item</h4>
            <button onClick={resetForm} className="p-1 rounded-lg hover:bg-white/5 text-zinc-400">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Category Dropdown */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Pay Category</label>
              <select
                value={formCategoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.rateType})
                  </option>
                ))}
              </select>
            </div>

            {/* Rate */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Rate ($)
                {selectedCategory && (
                  <span className="text-zinc-600 ml-1">
                    {selectedCategory.rateType === 'hourly'
                      ? 'per hour'
                      : selectedCategory.rateType === 'annual'
                        ? 'base rate'
                        : 'fixed amount'}
                  </span>
                )}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
              </div>
            </div>

            {/* Hours Per Week (hourly only) */}
            {selectedCategory?.rateType === 'hourly' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Hours / Week</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="168"
                  value={formHoursPerWeek}
                  onChange={(e) => setFormHoursPerWeek(e.target.value)}
                  placeholder="38"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
              </div>
            )}

            {/* Annual Salary (annual only) */}
            {selectedCategory?.rateType === 'annual' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Annual Salary ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={formAnnualSalary}
                    onChange={(e) => setFormAnnualSalary(e.target.value)}
                    placeholder="65000"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                  />
                </div>
              </div>
            )}

            {/* Effective Date */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Effective Date</label>
              <input
                type="date"
                value={formEffectiveDate}
                onChange={(e) => setFormEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2">
            <button
              onClick={handleAddPayItem}
              disabled={!formCategoryId || !formRate || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFCC00] text-black font-semibold text-sm hover:bg-[#FFCC00]/90 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Saving...' : 'Add Pay Item'}
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

      {/* Pay Structure Table */}
      {displayItems.length === 0 ? (
        <div className="neu-raised rounded-2xl p-8 text-center">
          <Calculator className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No pay items configured</p>
          <p className="text-xs text-zinc-500 mt-1">
            Add pay items to build this employee&apos;s pay structure.
          </p>
        </div>
      ) : (
        <div className="neu-raised rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                  Category
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                  Rate Type
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                  Rate
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                  Hrs/Wk
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                  Annual
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                  Effective
                </th>
                {showHistory && (
                  <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                    Active
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, idx) => {
                const catType = (item.categoryType ?? 'ordinary') as CategoryType;
                const style = TYPE_STYLES[catType] ?? TYPE_STYLES.ordinary;

                let annualDisplay = 0;
                const rateInDollars = item.rateCents / 100;
                if (item.rateType === 'hourly') {
                  annualDisplay =
                    rateInDollars * (item.hoursPerWeek ?? 38) * (item.multiplier || 1) * 52;
                } else if (item.rateType === 'annual') {
                  annualDisplay =
                    item.annualSalaryCents != null ? item.annualSalaryCents / 100 : rateInDollars;
                } else {
                  annualDisplay = rateInDollars * (item.multiplier || 1) * 52;
                }

                return (
                  <tr
                    key={item.id ?? idx}
                    className={`border-b border-white/5 last:border-0 ${
                      !item.isActive ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.text}`}
                        >
                          {catType}
                        </span>
                        <span className="text-sm text-white font-medium">
                          {item.categoryName ?? 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <span className="text-xs text-zinc-400 capitalize">{item.rateType}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-sm text-white font-mono">
                        {centsToDollars(item.rateCents)}
                      </span>
                      {item.rateType === 'hourly' && (
                        <span className="text-zinc-500 text-xs">/hr</span>
                      )}
                      {item.multiplier > 1 && (
                        <span className="text-purple-400 text-xs ml-1">({item.multiplier}x)</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right hidden md:table-cell">
                      <span className="text-sm text-zinc-400">
                        {item.rateType === 'hourly' ? (item.hoursPerWeek ?? 38) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right hidden lg:table-cell">
                      <span className="text-sm text-zinc-300 font-mono">
                        $
                        {annualDisplay.toLocaleString('en-AU', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className="text-xs text-zinc-500">
                        {item.effectiveDate
                          ? new Date(item.effectiveDate).toLocaleDateString('en-AU')
                          : '-'}
                      </span>
                    </td>
                    {showHistory && (
                      <td className="px-4 py-2.5 text-center">
                        {item.isActive ? (
                          <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-zinc-600 mx-auto" />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Super Guarantee Line */}
          <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between bg-[#FFCC00]/[0.03]">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFCC00]/10 text-[#FFCC00]">
                super
              </span>
              <span className="text-sm text-zinc-300">
                Super Guarantee ({(SUPER_RATE * 100).toFixed(1)}% of OTE)
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm text-[#FFCC00] font-mono font-semibold">
                $
                {summary.superMonthly.toLocaleString('en-AU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                /mo
              </span>
              <span className="text-xs text-zinc-500 ml-2">
                ($
                {summary.superAnnual.toLocaleString('en-AU', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
                /yr)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
