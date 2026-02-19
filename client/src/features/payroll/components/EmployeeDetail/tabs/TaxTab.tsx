import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { submitTaxDeclaration } from '../../../../../api';
import type { TaxDeclarationRecord } from '../types.js';

interface TaxTabProps {
  taxDeclaration: TaxDeclarationRecord | null;
  employeeId: string;
  onRefresh: () => void;
}

export function TaxTab({ taxDeclaration, employeeId, onRefresh }: TaxTabProps) {
  const [editing, setEditing] = useState(!taxDeclaration);
  const [form, setForm] = useState({
    tax_free_threshold: taxDeclaration?.tax_free_threshold ?? true,
    has_help_debt: taxDeclaration?.has_help_debt ?? false,
    has_sfss_debt: taxDeclaration?.has_sfss_debt ?? false,
    tax_offset_claimed: taxDeclaration?.tax_offset_claimed ?? false,
    dependants: taxDeclaration?.dependants ?? 0,
  });

  const handleSave = async () => {
    try {
      await submitTaxDeclaration(employeeId, form);
      setEditing(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to save tax declaration', e);
    }
  };

  const checkboxField = (key: string, label: string) => (
    <label htmlFor="taxtab-f1" className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-border/50 cursor-pointer">
      <input id="taxtab-f1"
        type="checkbox"
        checked={form[key as keyof typeof form] as boolean}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
        disabled={!editing}
        className="h-4 w-4 rounded border-zinc-600 text-cba-gold focus:ring-[#FFCC00]/40"
      />
      <span className="text-sm text-primary">{label}</span>
    </label>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-primary">Tax Declaration</h3>
        {!editing && taxDeclaration && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-cba-gold border border-border rounded-lg hover:border-cba-gold/30 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      <div className="space-y-3">
        {checkboxField('tax_free_threshold', 'Claim the tax-free threshold')}
        {checkboxField('has_help_debt', 'Has HELP / HECS debt')}
        {checkboxField('has_sfss_debt', 'Has SFSS debt')}
        {checkboxField('tax_offset_claimed', 'Claiming tax offset')}

        <div className="p-3 rounded-xl bg-white/[0.02] border border-border/50">
          <label htmlFor="taxtab-f2" className="text-xs font-medium text-muted uppercase tracking-wider">
            Number of Dependants
          </label>
          <input id="taxtab-f2"
            type="number"
            min="0"
            value={form.dependants}
            onChange={(e) => setForm({ ...form, dependants: parseInt(e.target.value) || 0 })}
            disabled={!editing}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-overlay border border-border text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40 disabled:opacity-60"
          />
        </div>
      </div>

      {editing && (
        <div className="flex gap-2 justify-end mt-4">
          {taxDeclaration && (
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium text-black bg-cba-gold rounded-lg hover:bg-cba-gold/90 transition-colors"
          >
            Save Declaration
          </button>
        </div>
      )}
    </div>
  );
}
