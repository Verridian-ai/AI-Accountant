import { useRef, useMemo, useLayoutEffect } from 'react';
import type { SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Transaction, Account } from '../types/ledger';
import { createLedgerColumns } from './LedgerTableColumns';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper component for dynamic height rows (used for virtual scrolling spacers)
const DynamicHeightRow = ({ height, children }: { height: number; children: React.ReactNode }) => {
  const ref = useRef<HTMLTableRowElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.style.height = `${height}px`;
  }, [height]);
  return <tr ref={ref}>{children}</tr>;
};

// Helper component for dynamic width header cells
const DynamicTh = ({
  width,
  children,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableHeaderCellElement> & { width?: number }) => {
  const ref = useRef<HTMLTableHeaderCellElement>(null);
  useLayoutEffect(() => {
    if (ref.current && width) {
      ref.current.style.setProperty('--column-width', `${width}px`);
    }
  }, [width]);
  return (
    <th ref={ref} className={className} {...props}>
      {children}
    </th>
  );
};

interface BulkSelectActions {
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
}

interface LedgerTableProps {
  transactions: Transaction[];
  accounts: Account[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  globalFilter: string;
  onGlobalFilterChange: (filter: string) => void;
  editingId: string | null;
  editForm: Partial<Transaction>;
  setEditForm: (form: Partial<Transaction>) => void;
  setEditingId: (id: string | null) => void;
  handleEditStart: (tx: Transaction) => void;
  handleSave: (id: string) => void;
  handleDelete: (id: string) => void;
  handleSplitStart: (tx: Transaction) => void;
  categories: string[];
  bulkSelect?: BulkSelectActions;
  onSelectAll?: () => void;
}

export function LedgerTable({
  transactions,
  accounts,
  sorting,
  onSortingChange,
  globalFilter,
  onGlobalFilterChange,
  editingId,
  editForm,
  setEditForm,
  setEditingId,
  handleEditStart,
  handleSave,
  handleDelete,
  handleSplitStart,
  categories,
  bulkSelect,
  onSelectAll,
}: LedgerTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Use ref for edit state to prevent column recreation on every render
  const editStateRef = useRef({ editingId, editForm });
  editStateRef.current = { editingId, editForm };

  const bulkSelectRef = useRef(bulkSelect || null);
  bulkSelectRef.current = bulkSelect || null;

  const columns = useMemo(
    () =>
      createLedgerColumns({
        editStateRef,
        accounts,
        categories,
        setEditForm,
        handleEditStart,
        handleSave,
        handleDelete,
        handleSplitStart,
        setEditingId,
        bulkSelectRef: bulkSelect ? bulkSelectRef : undefined,
        onSelectAll,
      }),
    [accounts, categories, setEditForm, handleEditStart, handleSave, handleDelete, handleSplitStart, setEditingId, !!bulkSelect, onSelectAll]
  );

  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange(newSorting);
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, globalFilter },
    onGlobalFilterChange,
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="py-32 text-center">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 neu-inset rounded-3xl flex items-center justify-center">
            <Search className="h-10 w-10 text-zinc-800" />
          </div>
          <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">
            No transactions found
          </p>
        </div>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex-1 bg-black/20 border-t border-white/5 relative group/table">
      {/* Horizontal Scroll Indicators */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-black/20 to-transparent pointer-events-none z-10 opacity-0 group-hover/table:opacity-100 transition-opacity md:hidden" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-black/20 to-transparent pointer-events-none z-10 opacity-0 group-hover/table:opacity-100 transition-opacity md:hidden" />

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
                    const isSticky = h.id === 'actions';
                    const isSorted = h.column.getIsSorted();
                    const ariaSortValue:
                      | 'ascending'
                      | 'descending'
                      | 'none'
                      | undefined = !h.column.getCanSort()
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
                          isSticky &&
                            'lg:sticky lg:right-0 lg:bg-[#12121a] lg:z-30 lg:shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.5)]'
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
              {/* Top spacer for virtual scrolling */}
              {virtualItems.length > 0 && (
                <DynamicHeightRow height={virtualItems[0]?.start || 0}>
                  <td colSpan={columns.length} />
                </DynamicHeightRow>
              )}

              {/* Virtual rows */}
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;

                return (
                  <tr
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="group transition-all duration-300"
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => {
                      const isSticky = cell.column.id === 'actions';
                      const tx = row.original;
                      const borderColor = tx.isTransfer
                        ? 'border-l-zinc-500/50'
                        : tx.amount > 0
                          ? 'border-l-emerald-500/50'
                          : 'border-l-red-500/50';
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-3 lg:px-6 py-3 lg:py-5 bg-[#12121a] first:rounded-l-xl last:rounded-r-xl border-y border-white/5 first:border-l last:border-r transition-shadow duration-300 group-hover:bg-[#16161f] group-hover:border-white/10 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]',
                            editingId === row.original.id && 'bg-[#16161f] border-[#FFCC00]/20',
                            cell.column.id === 'gstApplicable' && 'hidden md:table-cell',
                            cellIndex === 0 && `border-l-2 ${borderColor}`,
                            isSticky &&
                              'lg:sticky lg:right-0 lg:z-30 lg:shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.5)] lg:border-l lg:border-white/5'
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Bottom spacer for virtual scrolling */}
              {virtualItems.length > 0 && (
                <DynamicHeightRow
                  height={
                    rowVirtualizer.getTotalSize() -
                    (virtualItems[virtualItems.length - 1]?.end || 0)
                  }
                >
                  <td colSpan={columns.length} />
                </DynamicHeightRow>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
