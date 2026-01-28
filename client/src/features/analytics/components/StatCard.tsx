import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
            "neu-raised rounded-[2rem] p-6 interactive-card group relative overflow-hidden border border-white/5",
            className
        )}>
            {/* Mission Control Pattern Overlay */}
            <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.03),transparent)] pointer-events-none" />

            {/* Kinetic Energy Core (Glow) */}
            <div className={cn(
                "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-40 transition-opacity duration-700",
                trend === 'up' && "bg-emerald-500",
                trend === 'down' && "bg-red-500",
                !trend && "bg-[#FFCC00]"
            )} />

            <div className="relative flex items-start justify-between gap-4">
                <div className="space-y-4">
                    {/* Header: Label + Status */}
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full animate-pulse",
                            trend === 'up' && "bg-emerald-500",
                            trend === 'down' && "bg-red-500",
                            !trend && "bg-[#FFCC00]"
                        )} />
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.25em] leading-none">
                            {title}
                        </p>
                    </div>

                    {/* Content: Value + Subtitle */}
                    <div className="flex flex-col gap-1">
                        <h3 className={cn(
                            "text-2xl sm:text-3xl font-black tracking-tighter leading-none transition-transform duration-500 group-hover:translate-x-1",
                            trend === 'up' && "text-emerald-400",
                            trend === 'down' && "text-red-400",
                            !trend && "text-gradient-gold"
                        )}>
                            {value}
                        </h3>
                        {subtitle && (
                            <div className="flex items-center gap-1.5 mt-1">
                                <Zap className="w-2.5 h-2.5 text-zinc-700" />
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic">
                                    {subtitle}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Primary Intelligence Module (Icon) */}
                <div className={cn(
                    "neu-inset p-4 rounded-2xl transition-all duration-500 shrink-0 border border-white/5",
                    trend === 'up' && "group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] group-hover:border-emerald-500/30",
                    trend === 'down' && "group-hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] group-hover:border-red-500/30",
                    !trend && "group-hover:shadow-[0_0_20px_rgba(255,204,0,0.2)] group-hover:border-[#FFCC00]/30"
                )}>
                    <Icon className={cn(
                        "h-6 w-6 transition-all duration-500 transform group-hover:scale-110",
                        trend === 'up' && "text-emerald-500",
                        trend === 'down' && "text-red-500",
                        !trend && "text-[#FFCC00]"
                    )} />
                </div>
            </div>

            {/* Signal Scan Line */}
            <div className={cn(
                "absolute bottom-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-1 group-hover:translate-y-0",
                trend === 'up' && "bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_15px_rgba(16,185,129,0.5)]",
                trend === 'down' && "bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.5)]",
                !trend && "bg-gradient-to-r from-transparent via-[#FFCC00] to-transparent shadow-[0_0_15px_rgba(255,204,0,0.5)]"
            )} />
        </div>
    );
}

export function StatCardSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn(
            "neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5",
            className
        )}>
             <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
             <div className="relative flex items-start justify-between gap-4">
                 <div className="space-y-4 w-full">
                     <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 animate-pulse" />
                         <Skeleton className="h-3 w-20 rounded-md" />
                     </div>
                     <div className="flex flex-col gap-2">
                         <Skeleton className="h-8 w-24 rounded-lg" />
                         <Skeleton className="h-3 w-32 rounded-md" />
                     </div>
                 </div>
                 <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
             </div>
        </div>
    );
}