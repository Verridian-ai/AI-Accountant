import { cn } from '../lib/utils';

interface CategoryChartProps {
    data: Record<string, number>;
    title?: string;
}

const COLORS = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-yellow-500',
    'bg-red-500',
];

export function CategoryChart({ data, title = 'Spending by Category' }: CategoryChartProps) {
    const entries = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    
    if (entries.length === 0) {
        return (
            <div className="bg-white rounded-xl border p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
                <p className="text-gray-400 text-sm text-center py-8">No data available</p>
            </div>
        );
    }

    const formatAmount = (cents: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
        }).format(Math.abs(cents) / 100);
    };

    return (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
            
            <div className="space-y-3">
                {entries.map(([category, amount], index) => {
                    const percentage = total > 0 ? (amount / total) * 100 : 0;
                    return (
                        <div key={category} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700 font-medium truncate max-w-[60%]">
                                    {category}
                                </span>
                                <span className="text-gray-500">
                                    {formatAmount(amount)}
                                </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all", COLORS[index % COLORS.length])}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold text-gray-900">{formatAmount(total)}</span>
            </div>
        </div>
    );
}

