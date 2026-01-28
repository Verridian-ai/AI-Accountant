import { useMemo } from 'react';
import {
    CheckCircle2,
    Rocket,
    ArrowRight,
    Building2,
    Receipt,
    Target,
    FileText,
    Sparkles,
    Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingStepProps } from '../types';
import { ENTITY_TYPES, FINANCIAL_GOALS } from '../types';

export function CompletionStep({ data, onNext }: OnboardingStepProps) {
    const entityLabel = useMemo(() => {
        return ENTITY_TYPES.find(e => e.id === data.entityType)?.label || data.entityType;
    }, [data.entityType]);

    const selectedGoalLabels = useMemo(() => {
        return data.selectedGoals
            .map(id => FINANCIAL_GOALS.find(g => g.id === id)?.label)
            .filter((label): label is NonNullable<typeof label> => Boolean(label));
    }, [data.selectedGoals]);

    // Calculate setup completion score
    const completionItems = useMemo(() => {
        const items = [
            { label: 'Profile setup', completed: true },
            { label: 'Entity type selected', completed: !!data.entityType },
            { label: 'Statement uploaded', completed: data.hasUploadedStatement },
            { label: 'Tax settings configured', completed: data.entityType === 'individual' || data.financialYearEnd !== undefined },
            { label: 'Goals defined', completed: data.selectedGoals.length > 0 },
        ];
        return items;
    }, [data]);

    const completedCount = completionItems.filter(i => i.completed).length;
    const completionPercent = Math.round((completedCount / completionItems.length) * 100);

    return (
        <div className="p-6 sm:p-10 space-y-8">
            {/* Celebration Header */}
            <div className="text-center">
                <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse rounded-full" />
                    <div className="relative w-24 h-24 cba-gold-gradient rounded-[2rem] flex items-center justify-center shadow-xl cba-gold-glow">
                        <Trophy className="w-12 h-12 text-[#0a0a0f]" />
                    </div>
                    <div className="absolute -right-2 -top-2 p-2 bg-emerald-500 rounded-xl shadow-lg animate-float">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
                    <span className="text-gradient-gold">You're all set!</span>
                </h2>
                <p className="text-sm text-zinc-400">
                    Your account is configured and ready to analyze your finances.
                </p>
            </div>

            {/* Completion Progress */}
            <div className="neu-raised rounded-2xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                        Setup Completion
                    </span>
                    <span className="text-sm font-bold text-[#FFCC00]">
                        {completionPercent}%
                    </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                    <div
                        className="h-full cba-gold-gradient transition-all duration-1000 ease-out rounded-full"
                        style={{ width: `${completionPercent}%` }}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {completionItems.map((item, index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex items-center gap-2 text-xs",
                                item.completed ? "text-zinc-300" : "text-zinc-600"
                            )}
                        >
                            <CheckCircle2 className={cn(
                                "w-4 h-4",
                                item.completed ? "text-emerald-400" : "text-zinc-700"
                            )} />
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Profile Summary */}
                <SummaryCard
                    icon={Building2}
                    title="Profile"
                    items={[
                        `Type: ${entityLabel}`,
                        data.industry ? `Industry: ${data.industry}` : null,
                        data.abn ? `ABN: ${data.abn}` : null,
                    ].filter(Boolean) as string[]}
                />

                {/* Tax Summary */}
                <SummaryCard
                    icon={Receipt}
                    title="Tax Settings"
                    items={[
                        data.isRegisteredForGst ? 'GST Registered' : 'Not GST Registered',
                        data.isRegisteredForGst ? `BAS: ${data.basFrequency}` : null,
                        `Financial Year: ${data.financialYearEnd === 'june' ? 'July-June' : 'Jan-Dec'}`,
                    ].filter(Boolean) as string[]}
                />

                {/* Uploads Summary */}
                <SummaryCard
                    icon={FileText}
                    title="Statements"
                    items={[
                        data.hasUploadedStatement
                            ? 'First statement uploaded'
                            : 'No statements yet - upload when ready',
                    ]}
                    highlight={data.hasUploadedStatement}
                />

                {/* Goals Summary */}
                <SummaryCard
                    icon={Target}
                    title="Goals"
                    items={
                        selectedGoalLabels.length > 0
                            ? selectedGoalLabels
                            : ['No goals selected']
                    }
                    highlight={selectedGoalLabels.length > 0}
                />
            </div>

            {/* Next Steps */}
            <div className="neu-inset rounded-2xl p-6 border border-[#FFCC00]/10 bg-[#FFCC00]/[0.02]">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-[#FFCC00]" />
                    <span className="text-[10px] font-black uppercase text-[#FFCC00] tracking-widest">
                        What's Next
                    </span>
                </div>
                <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-sm text-zinc-400">
                        <span className="w-5 h-5 rounded-full bg-[#FFCC00]/20 text-[#FFCC00] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            1
                        </span>
                        <span>
                            {data.hasUploadedStatement
                                ? 'Review your AI-categorized transactions and make corrections'
                                : 'Upload your first bank statement to get started'}
                        </span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-zinc-400">
                        <span className="w-5 h-5 rounded-full bg-[#FFCC00]/20 text-[#FFCC00] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            2
                        </span>
                        <span>Explore your spending insights on the Analytics tab</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-zinc-400">
                        <span className="w-5 h-5 rounded-full bg-[#FFCC00]/20 text-[#FFCC00] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            3
                        </span>
                        <span>
                            {data.isRegisteredForGst
                                ? 'Check the BAS Dashboard for your GST summary'
                                : 'Use the chat to ask questions about your finances'}
                        </span>
                    </li>
                </ul>
            </div>

            {/* CTA Button */}
            <div className="text-center">
                <button
                    onClick={onNext}
                    className={cn(
                        "group inline-flex items-center gap-3 px-8 py-4",
                        "cba-gold-gradient text-[#0a0a0f] font-black text-sm uppercase tracking-[0.15em]",
                        "rounded-2xl btn-press shadow-xl cba-gold-glow",
                        "transition-all duration-300 hover:scale-105"
                    )}
                >
                    <Rocket className="w-5 h-5" />
                    <span>Launch Dashboard</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
}

interface SummaryCardProps {
    icon: React.ElementType;
    title: string;
    items: string[];
    highlight?: boolean;
}

function SummaryCard({ icon: Icon, title, items, highlight }: SummaryCardProps) {
    return (
        <div className={cn(
            "neu-raised-sm rounded-xl p-4 border transition-all",
            highlight ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/5"
        )}>
            <div className="flex items-center gap-2 mb-3">
                <Icon className={cn(
                    "w-4 h-4",
                    highlight ? "text-emerald-400" : "text-zinc-500"
                )} />
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                    {title}
                </span>
            </div>
            <ul className="space-y-1">
                {items.map((item, index) => (
                    <li key={index} className="text-xs text-zinc-400">
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default CompletionStep;
