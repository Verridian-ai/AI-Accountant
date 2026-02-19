import { useState } from 'react';
import { addBankDetails } from '../../../../../api';
import type { BankDetailRecord } from '../types.js';

interface BankTabProps {
  bankDetails: BankDetailRecord[];
  employeeId: string;
  onRefresh: () => void;
}

export function BankTab({ bankDetails, employeeId, onRefresh }: BankTabProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    bsb: '',
    account_number: '',
    account_name: '',
    split_percentage: '100',
  });

  const handleAdd = async () => {
    try {
      await addBankDetails(employeeId, {
        ...form,
        split_percentage: parseFloat(form.split_percentage),
      });
      setAdding(false);
      setForm({ bsb: '', account_number: '', account_name: '', split_percentage: '100' });
      onRefresh();
    } catch (e) {
      console.error('Failed to add bank details', e);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-primary">Bank Details</h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-cba-gold border border-border rounded-lg hover:border-cba-gold/30 transition-colors"
        >
          + Add Account
        </button>
      </div>

      {bankDetails.length === 0 && !adding && (
        <p className="text-sm text-muted text-center py-8">No bank details on file</p>
      )}

      {bankDetails.map((bd, i) => (
        <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-border/50 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted">BSB</p>
              <p className="text-sm text-primary font-mono mt-0.5">{bd.bsb_masked ?? bd.bsb}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Account Number</p>
              <p className="text-sm text-primary font-mono mt-0.5">
                {bd.account_number_masked ?? '****' + (bd.account_number?.slice(-4) ?? '****')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Account Name</p>
              <p className="text-sm text-primary mt-0.5">{bd.account_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Split %</p>
              <p className="text-sm text-primary mt-0.5">{bd.split_percentage}%</p>
            </div>
          </div>
        </div>
      ))}

      {adding && (
        <div className="p-4 rounded-xl border border-cba-gold/20 bg-cba-gold/[0.02] space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              placeholder="BSB (6 digits)"
              value={form.bsb}
              onChange={(e) => setForm({ ...form, bsb: e.target.value })}
              maxLength={6}
              className="px-3 py-2 rounded-lg bg-overlay border border-border text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
            <input
              placeholder="Account Number"
              value={form.account_number}
              onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              className="px-3 py-2 rounded-lg bg-overlay border border-border text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
            <input
              placeholder="Account Name"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              className="px-3 py-2 rounded-lg bg-overlay border border-border text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
            <input
              placeholder="Split %"
              type="number"
              value={form.split_percentage}
              onChange={(e) => setForm({ ...form, split_percentage: e.target.value })}
              className="px-3 py-2 rounded-lg bg-overlay border border-border text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs font-medium text-black bg-cba-gold rounded-lg hover:bg-cba-gold/90 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
