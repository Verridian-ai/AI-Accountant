import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { GSTCategory } from '@/features/gst/types';
import { AlertTriangle } from 'lucide-react';

interface GSTBadgeProps {
    gstCategory: GSTCategory;
    gstAmount?: number; // cents
    confidence?: number; // 0-1
    size?: 'sm' | 'md';
    className?: string;
}

const GST_STYLES: Record<GSTCategory, { bg: string; text: string; border: string; label: string; showAmount: boolean }> = {
    taxable_10: {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        label: 'GST',
        showAmount: true,
    },
    gst_free: {
        bg: 'bg-gray-500/20',
        text: 'text-gray-400',
        border: 'border-gray-500/30',
        label: 'FRE',
        showAmount: false,
    },
    input_taxed: {
        bg: 'bg-orange-500/20',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        label: 'INP',
        showAmount: false,
    },
    export: {
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        label: 'EXP',
        showAmount: false,
    },
    capital: {
        bg: 'bg-purple-500/20',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        label: 'CAP',
        showAmount: true,
    },
    private: {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/30',
        label: 'N-T',
        showAmount: false,
    },
    no_abn: {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        label: 'NO ABN',
        showAmount: false,
    },
};

export function GSTBadge({ gstCategory, gstAmount, confidence, size = 'sm', className }: GSTBadgeProps) {
    const style = GST_STYLES[gstCategory];
    const isLowConfidence = confidence !== undefined && confidence < 0.7;

    const sizeClasses = size === 'sm'
        ? 'px-2 py-0.5 text-[10px]'
        : 'px-2.5 py-1 text-xs';

    const displayText = style.showAmount && gstAmount !== undefined
        ? `${style.label} ${formatCurrency(gstAmount, true)}`
        : style.label;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full font-medium border whitespace-nowrap',
                sizeClasses,
                isLowConfidence
                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    : `${style.bg} ${style.text} ${style.border}`,
                className
            )}
        >
            {isLowConfidence && <AlertTriangle className="w-3 h-3" />}
            {isLowConfidence ? '?' : displayText}
        </span>
    );
}
