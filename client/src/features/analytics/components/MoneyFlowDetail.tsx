import React from 'react';
import { X } from 'lucide-react';
import type { Transaction } from '../../../api';
import type { SankeyNode, SankeyLink } from '../hooks/useMoneyFlow';

interface MoneyFlowDetailProps {
  selectedNode?: SankeyNode | null;
  selectedLink?: SankeyLink | null;
  nodes?: SankeyNode[];
  onClose: () => void;
  transactions?: Transaction[];
}

function formatAUD(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-${formatted}` : formatted;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function MoneyFlowDetailInner({
  selectedNode,
  selectedLink,
  nodes,
  onClose,
  transactions = [],
}: MoneyFlowDetailProps) {
  const isOpen = selectedNode != null || selectedLink != null;

  if (!isOpen) return null;

  let title = '';
  let matchedTransactions: Transaction[] = [];

  if (selectedNode) {
    title = selectedNode.name;
    const nodeName = selectedNode.name;
    matchedTransactions = transactions.filter((tx) => {
      if (tx.category === nodeName) return true;
      if (tx.accountId && `Account ${tx.accountId.slice(0, 6)}` === nodeName) return true;
      if (!tx.accountId && nodeName === 'Main Account') return true;
      return false;
    });
  } else if (selectedLink && nodes) {
    const sourceName = nodes[selectedLink.source]?.name ?? 'Source';
    const targetName = nodes[selectedLink.target]?.name ?? 'Target';
    title = `${sourceName} \u2192 ${targetName}`;
  }

  // Sort by absolute amount descending
  const sorted = [...matchedTransactions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const totalAmount = sorted.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="absolute right-0 top-0 h-full w-80 neu-raised rounded-l-xl border-l border-[#FFCC00]/20 z-50 flex flex-col overflow-hidden">
      {/* Gold header bar */}
      <div className="bg-gradient-to-r from-[#FFCC00]/20 to-[#CC9900]/10 border-b border-[#FFCC00]/30 px-4 py-3 flex items-center justify-between shrink-0">
        <h3 className="text-[#FFCC00] font-semibold text-sm truncate pr-2">{title}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-[#FFCC00] transition-colors p-1 rounded hover:bg-gray-700/50"
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary stats */}
      <div className="px-4 py-3 border-b border-gray-700/50 shrink-0">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400">Total Amount</p>
            <p
              className={`text-sm font-bold ${totalAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {formatAUD(totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Transactions</p>
            <p className="text-sm font-bold text-gray-200">{sorted.length}</p>
          </div>
          {selectedLink && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400">Flow Value</p>
              <p className="text-sm font-bold text-[#FFCC00]">{formatAUD(selectedLink.value)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction list sorted by amount desc */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No matching transactions
          </div>
        ) : (
          <div className="divide-y divide-gray-700/30">
            {sorted.map((tx) => (
              <div key={tx.id} className="px-4 py-2.5 hover:bg-gray-700/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-200 truncate">{tx.description}</p>
                    <p className="text-[10px] text-gray-500">{formatDate(tx.date)}</p>
                  </div>
                  <p
                    className={`text-xs font-mono font-medium shrink-0 ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {formatAUD(tx.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const MoneyFlowDetail = React.memo(MoneyFlowDetailInner);
