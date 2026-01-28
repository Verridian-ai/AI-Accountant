import type { ColumnDef, FilterFn } from '@tanstack/react-table';
import type { Transaction } from '@/api';
import { ArrowUpDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

// Custom filter function for date range filtering
export const dateRangeFilterFn: FilterFn<Transaction> = (row, columnId, filterValue) => {
    const { startDate, endDate } = filterValue as { startDate: string; endDate: string };

    // If no date filters are set, show all rows
    if (!startDate && !endDate) return true;

    const cellValue = row.getValue(columnId) as string;
    if (!cellValue) return false;

    // Parse the date from the cell (assuming format like "2024-01-15" or similar)
    const rowDate = new Date(cellValue);
    if (isNaN(rowDate.getTime())) return true; // If can't parse, show the row

    // Normalize to start of day for comparison
    rowDate.setHours(0, 0, 0, 0);

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return rowDate >= start && rowDate <= end;
    } else if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        return rowDate >= start;
    } else if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return rowDate <= end;
    }

    return true;
};

export const columns: ColumnDef<Transaction>[] = [
    {
        accessorKey: 'date',
        header: ({ column }) => {
            return (
                <button
                    type="button"
                    className="flex items-center gap-1 hover:text-gray-900"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Date
                    <ArrowUpDown className="h-4 w-4" />
                </button>
            )
        },
        cell: ({ row }) => <div className="font-mono text-sm">{row.getValue('date')}</div>,
        filterFn: dateRangeFilterFn,
        enableColumnFilter: true,
    },
    {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
            <div className="max-w-[300px] truncate" title={row.getValue('description')}>
                {row.getValue('description')}
            </div>
        ),
    },
    {
        accessorKey: 'amount',
        header: ({ column }) => (
            <button
                type="button"
                className="flex items-center gap-1 hover:text-gray-900"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
                Amount
                <ArrowUpDown className="h-4 w-4" />
            </button>
        ),
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue('amount'));
            const formatted = formatCurrency(amount);

            return <div className={cn("font-medium", amount < 0 ? "text-red-500" : "text-green-600")}>{formatted}</div>
        },
    },
    {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => {
            const cat = row.getValue('category') as string;
            return (
                <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-semibold",
                    !cat || cat === 'Uncategorized' ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"
                )}>
                    {cat || 'Uncategorized'}
                </span>
            )
        }
    },
    {
        accessorKey: 'confidenceScore',
        header: 'AI Confidence',
        cell: ({ row }) => {
            const score = parseFloat(row.getValue('confidenceScore')) || 0;
            return (
                <div className="flex items-center gap-2">
                    {score < 0.8 ? (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-xs text-gray-400">{Math.round(score * 100)}%</span>
                </div>
            )
        }
    }
];

