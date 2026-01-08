import { useState } from 'react';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
    getFilteredRowModel,
} from '@tanstack/react-table';
import { Transaction } from '../api';
import { ArrowUpDown, AlertCircle, CheckCircle2, Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface TransactionTableProps {
    transactions: Transaction[];
    loading?: boolean;
}

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
            const amount = parseFloat(row.getValue('amount')) / 100;
            const formatted = new Intl.NumberFormat('en-AU', {
                style: 'currency',
                currency: 'AUD',
            }).format(amount);

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

export function TransactionTable({ transactions, loading = false }: TransactionTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    const table = useReactTable({
        data: transactions,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
    });

    return (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="font-semibold text-gray-800">
                    Transactions
                    <span className="ml-2 text-sm font-normal text-gray-500">
                        ({transactions.length} total)
                    </span>
                </h2>
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-9 pr-4 py-2 text-sm border rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th key={header.id} className="px-6 py-3 font-medium">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="h-32 text-center">
                                        <div className="text-gray-400">
                                            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>No transactions found</p>
                                            <p className="text-xs mt-1">Drop a PDF statement in the statements folder to get started</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
