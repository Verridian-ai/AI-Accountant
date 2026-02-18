import type { Table, ColumnDef, Row } from '@tanstack/react-table';
import type { Virtualizer } from '@tanstack/react-virtual';
import { flexRender } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/api';
import { DynamicHeightRow, DynamicTh } from './DynamicTableComponents.js';

interface VirtualizedTableProps {
  table: Table<Transaction>;
  columns: ColumnDef<Transaction>[];
  rows: Row<Transaction>[];
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  parentRef: React.RefObject<HTMLDivElement>;
  editingId: string | null;
}

export function VirtualizedTable({
  table,
  columns,
  rows,
  rowVirtualizer,
  parentRef,
  editingId,
}: VirtualizedTableProps) {
  return (
    <div
      ref={parentRef}
      className="overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent max-h-[70vh]"
    >
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 min-w-max">
        <table
          className="transaction-table w-full border-separate border-spacing-y-2 lg:border-spacing-y-3"
          aria-label="Financial Transactions Ledger"
        >
          <caption className="sr-only">
            List of financial transactions with details including date, description, amount, and
            category.
          </caption>
          <thead className="sticky top-0 z-20 bg-[#12121a]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="text-zinc-600">
                {hg.headers.map((h) => {
                  const isSorted = h.column.getIsSorted();
                  const ariaSortValue: 'ascending' | 'descending' | 'none' | undefined =
                    !h.column.getCanSort()
                      ? undefined
                      : isSorted === 'asc'
                        ? 'ascending'
                        : isSorted === 'desc'
                          ? 'descending'
                          : 'none';
                  return (
                    <DynamicTh
                      key={h.id}
                      scope="col"
                      aria-sort={ariaSortValue}
                      className={cn(
                        'px-3 lg:px-6 pb-2 text-left whitespace-nowrap dynamic-column-width',
                        h.id === 'gstApplicable' && 'hidden md:table-cell',
                      )}
                      width={h.column.getSize() !== 150 ? h.column.getSize() : undefined}
                    >
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
                    </DynamicTh>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-20 h-20 neu-inset rounded-3xl flex items-center justify-center">
                      <Search className="h-10 w-10 text-zinc-800" />
                    </div>
                    <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">
                      No matching nodes in current view
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {rowVirtualizer.getVirtualItems().length > 0 && (
                  <DynamicHeightRow height={rowVirtualizer.getVirtualItems()[0]?.start || 0}>
                    <td colSpan={columns.length} />
                  </DynamicHeightRow>
                )}
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  if (!row) return null;
                  return (
                    <tr
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="group transition-all duration-300"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-3 lg:px-6 py-3 lg:py-5 bg-[#12121a] first:rounded-l-xl last:rounded-r-xl border-y border-white/5 first:border-l last:border-r transition-shadow duration-300 group-hover:bg-[#16161f] group-hover:border-white/10 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]',
                            editingId === row.original.id && 'bg-[#16161f] border-[#FFCC00]/20',
                            cell.column.id === 'gstApplicable' && 'hidden md:table-cell',
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {rowVirtualizer.getVirtualItems().length > 0 && (
                  <DynamicHeightRow
                    height={
                      rowVirtualizer.getTotalSize() -
                      (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]
                        ?.end || 0)
                    }
                  >
                    <td colSpan={columns.length} />
                  </DynamicHeightRow>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
