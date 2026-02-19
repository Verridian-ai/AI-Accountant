import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { addSuperFund } from '../../../../../api';
import { SUPER_MIN_RATE } from '../constants.js';
import type { SuperFundRecord } from '../types.js';

interface SuperTabProps {
  superFund: SuperFundRecord | null;
  employeeId: string;
  onRefresh: () => void;
}

export function SuperTab({ superFund, employeeId, onRefresh }: SuperTabProps) {
  const [editing, setEditing] = useState(!superFund);
  const [form, setForm] = useState({
    fund_name: superFund?.fund_name ?? '',
    fund_abn: superFund?.fund_abn ?? '',
    usi: superFund?.usi ?? '',
    member_number: superFund?.member_number ?? '',
    contribution_rate: String(superFund?.contribution_rate ?? '11.5'),
  });

  const handleSave = async () => {
    try {
      await addSuperFund(employeeId, {
        ...form,
        contribution_rate: parseFloat(form.contribution_rate),
      });
      setEditing(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to save super', e);
    }
  };

  const rate = parseFloat(form.contribution_rate) || 0;
  const isCompliant = rate >= SUPER_MIN_RATE;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-primary">Superannuation</h3>
        {!editing && superFund && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-cba-gold border border-border rounded-lg hover:border-cba-gold/30 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {!superFund && !editing ? (
        <p className="text-sm text-muted text-center py-8">No super fund on file</p>
      ) : editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'fund_name', label: 'Fund Name', placeholder: 'e.g. Australian Super' },
              { key: 'fund_abn', label: 'Fund ABN (11 digits)', placeholder: '12345678901' },
              { key: 'usi', label: 'USI', placeholder: 'Unique Superannuation Identifier' },
              { key: 'member_number', label: 'Member Number', placeholder: 'Member #' },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted uppercase tracking-wider">
                  {f.label}
                </label>
                <input
                  type="text"
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-overlay border border-border text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-muted uppercase tracking-wider">
                Contribution Rate (%)
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  step="0.5"
                  value={form.contribution_rate}
                  onChange={(e) => setForm({ ...form, contribution_rate: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-overlay border border-border text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isCompliant
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {isCompliant ? 'Compliant' : `Below ${SUPER_MIN_RATE}%`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {superFund && (
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
              Save Super Fund
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted">Fund Name</p>
            <p className="text-sm text-primary mt-0.5">{superFund?.fund_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Fund ABN</p>
            <p className="text-sm text-primary font-mono mt-0.5">{superFund?.fund_abn}</p>
          </div>
          <div>
            <p className="text-xs text-muted">USI</p>
            <p className="text-sm text-primary mt-0.5">{superFund?.usi ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Member Number</p>
            <p className="text-sm text-primary mt-0.5">{superFund?.member_number}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Contribution Rate</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-primary">{superFund?.contribution_rate}%</p>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  (superFund?.contribution_rate ?? 0) >= SUPER_MIN_RATE
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {(superFund?.contribution_rate ?? 0) >= SUPER_MIN_RATE
                  ? 'Compliant'
                  : `Below ${SUPER_MIN_RATE}%`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
