import { cn } from '../lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon: LucideIcon;
    trend?: 'up' | 'down' | 'neutral';
    className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className }: StatCardProps) {
    return (
        <div className={cn(
            "bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow",
            className
        )}>
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className={cn(
                        "text-2xl font-bold",
                        trend === 'up' && "text-green-600",
                        trend === 'down' && "text-red-600",
                        !trend && "text-gray-900"
                    )}>
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-xs text-gray-400">{subtitle}</p>
                    )}
                </div>
                <div className={cn(
                    "p-3 rounded-lg",
                    trend === 'up' && "bg-green-100",
                    trend === 'down' && "bg-red-100",
                    !trend && "bg-gray-100"
                )}>
                    <Icon className={cn(
                        "h-5 w-5",
                        trend === 'up' && "text-green-600",
                        trend === 'down' && "text-red-600",
                        !trend && "text-gray-600"
                    )} />
                </div>
            </div>
        </div>
    );
}

