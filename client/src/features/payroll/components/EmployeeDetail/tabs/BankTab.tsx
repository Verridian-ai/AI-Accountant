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
        <h3 className="text-lg font-semibold text-white">Bank Details</h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-[#FFCC00] border border-white/10 rounded-lg hover:border-[#FFCC00]/30 transition-colors"
        >
          + Add Account
        </button>
      </div>

      {bankDetails.length === 0 && !adding && (
        <p className="text-sm text-zinc-500 text-center py-8">No bank details on file</p>
      )}

      {bankDetails.map((bd, i) => (
        <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-zinc-500">BSB</p>
              <p className="text-sm text-white font-mono mt-0.5">{bd.bsb_masked ?? bd.bsb}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Account Number</p>
              <p className="text-sm text-white font-mono mt-0.5">
                {bd.account_number_masked ?? '****' + (bd.account_number?.slice(-4) ?? '****')}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Account Name</p>
              <p className="text-sm text-white mt-0.5">{bd.account_name}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Split %</p>
              <p className="text-sm text-white mt-0.5">{bd.split_percentage}%</p>
            </div>
          </div>
        </div>
      ))}

      {adding && (
        <div className="p-4 rounded-xl border border-[#FFCC00]/20 bg-[#FFCC00]/[0.02] space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              placeholder="BSB (6 digits)"
              value={form.bsb}
              onChange={(e) => setForm({ ...form, bsb: e.target.value })}
              maxLength={6}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
            <input
              placeholder="Account Number"
              value={form.account_number}
              onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
            <input
              placeholder="Account Name"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
            <input
              placeholder="Split %"
              type="number"
              value={form.split_percentage}
              onChange={(e) => setForm({ ...form, split_percentage: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs font-medium text-black bg-[#FFCC00] rounded-lg hover:bg-[#FFCC00]/90 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
