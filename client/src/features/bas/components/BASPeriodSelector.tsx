import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock } from 'lucide-react';

type PeriodType = 'monthly' | 'quarterly' | 'annual';

interface BASPeriodSelectorProps {
    selectedYear: number;
    selectedQuarter: number;
    periodType: PeriodType;
    onYearChange: (year: number) => void;
    onQuarterChange: (quarter: number) => void;
    onPeriodTypeChange: (type: PeriodType) => void;
    className?: string;
}

const getQuarterLabel = (q: number, year: number): string => {
    const labels: Record<number, string> = {
        1: `Jul-Sep ${year}`,
        2: `Oct-Dec ${year}`,
        3: `Jan-Mar ${year + 1}`,
        4: `Apr-Jun ${year + 1}`,
    };
    return labels[q] || '';
};

const getDueDate = (quarter: number, year: number): Date => {
    // BAS due dates: 28th of the month after quarter ends
    const dueDates: Record<number, { month: number; year: number }> = {
        1: { month: 9, year }, // Oct 28
        2: { month: 1, year: year + 1 }, // Feb 28
        3: { month: 3, year: year + 1 }, // Apr 28
        4: { month: 7, year: year + 1 }, // Aug 28
    };
    const d = dueDates[quarter];
    return d ? new Date(d.year, d.month, 28) : new Date();
};

const getDaysUntilDue = (dueDate: Date): number => {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const generateYearOptions = (): number[] => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
        years.push(currentYear - i);
    }
    return years;
};

export function BASPeriodSelector({
    selectedYear,
    selectedQuarter,
    periodType,
    onYearChange,
    onQuarterChange,
    onPeriodTypeChange,
    className,
}: BASPeriodSelectorProps) {
    const dueDate = getDueDate(selectedQuarter, selectedYear);
    const daysUntilDue = getDaysUntilDue(dueDate);
    const isOverdue = daysUntilDue < 0;

    return (
        <div className={cn('space-y-3', className)}>
            <div className="flex items-center gap-3 flex-wrap">
                {/* Financial Year */}
                <Select
                    value={String(selectedYear)}
                    onValueChange={(v) => onYearChange(parseInt(v))}
                >
                    <SelectTrigger className="w-[160px]">
                        <Calendar className="w-4 h-4 mr-2 opacity-50" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {generateYearOptions().map(year => (
                            <SelectItem key={year} value={String(year)}>
                                FY {year}-{(year + 1).toString().slice(2)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Quarter Buttons */}
                <div className="flex gap-1 rounded-xl bg-white/5 p-1 border border-white/10">
                    {[1, 2, 3, 4].map(q => (
                        <button
                            key={q}
                            className={cn(
                                'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                                selectedQuarter === q
                                    ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                            )}
                            onClick={() => onQuarterChange(q)}
                        >
                            Q{q}
                        </button>
                    ))}
                </div>

                {/* Period Type Toggle */}
                <div className="flex gap-1 rounded-xl bg-white/5 p-1 border border-white/10">
                    {(['monthly', 'quarterly', 'annual'] as PeriodType[]).map(type => (
                        <button
                            key={type}
                            className={cn(
                                'px-2.5 py-1 text-xs font-medium rounded-lg transition-all capitalize',
                                periodType === type
                                    ? 'bg-white/10 text-zinc-100'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            )}
                            onClick={() => onPeriodTypeChange(type)}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Period Info */}
            <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{getQuarterLabel(selectedQuarter, selectedYear)}</span>
                <span className="text-zinc-700">|</span>
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Due: {dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <Badge variant={isOverdue ? 'destructive' : 'outline'} className="text-[10px]">
                    {isOverdue
                        ? `Overdue by ${Math.abs(daysUntilDue)} days`
                        : `Due in ${daysUntilDue} days`
                    }
                </Badge>
            </div>
        </div>
    );
}
