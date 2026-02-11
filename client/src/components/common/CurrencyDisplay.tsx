import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
    amount: number; // in cents
    className?: string;
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
    const value = amount / 100;
    const absValue = Math.abs(value);
    const dollars = Math.floor(absValue);
    const cents = Math.round((absValue - dollars) * 100);

    // Format for screen readers: "negative 100 dollars and 50 cents"
    const accessibleText = `${amount < 0 ? 'negative ' : ''}${dollars} dollars and ${cents} cents`;

    const formatted = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD'
    }).format(absValue);

    return (
        <div
            className={cn(
                "font-black text-base tracking-tighter flex items-center gap-2 px-3 py-1.5 rounded-xl neu-inset border border-white/5 whitespace-nowrap",
                amount < 0 ? "text-red-400" : "text-emerald-400 shadow-[inset_0_0_15px_rgba(34,197,94,0.05)]",
                className
            )}
            role="img"
            aria-label={accessibleText}
        >
            <span aria-hidden="true" className="text-[10px] opacity-40">
                {amount < 0 ? '−' : '+'}
            </span>
            <span aria-hidden="true">
                {formatted}
            </span>
        </div>
    );
}
