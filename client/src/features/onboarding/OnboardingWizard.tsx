import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WelcomeStep } from './steps/WelcomeStep';
import { BusinessProfileStep } from './steps/BusinessProfileStep';
import { StatementUploadStep } from './steps/StatementUploadStep';
import { CategorySetupStep } from './steps/CategorySetupStep';
import { TaxSetupStep } from './steps/TaxSetupStep';
import { GoalsStep } from './steps/GoalsStep';
import { CompletionStep } from './steps/CompletionStep';
import {
    OnboardingData,
    ONBOARDING_STORAGE_KEY,
    createInitialOnboardingData,
} from './types';

interface OnboardingWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (data: OnboardingData) => void;
}

const STEPS = [
    { id: 'welcome', title: 'Welcome', component: WelcomeStep, skippable: false },
    { id: 'business', title: 'Business Profile', component: BusinessProfileStep, skippable: false },
    { id: 'upload', title: 'Upload Statement', component: StatementUploadStep, skippable: true },
    { id: 'categories', title: 'Categories', component: CategorySetupStep, skippable: true },
    { id: 'tax', title: 'Tax Setup', component: TaxSetupStep, skippable: true },
    { id: 'goals', title: 'Goals', component: GoalsStep, skippable: true },
    { id: 'complete', title: 'Complete', component: CompletionStep, skippable: false },
];

export function OnboardingWizard({ isOpen, onClose, onComplete }: OnboardingWizardProps) {
    const [data, setData] = useState<OnboardingData>(() => {
        // Try to restore from localStorage
        const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Validate that parsed data has expected shape to prevent type mismatches
                const initial = createInitialOnboardingData();
                // Merge with defaults to ensure all required fields exist
                return {
                    ...initial,
                    ...parsed,
                    // Ensure arrays are valid arrays
                    completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
                    customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
                    selectedGoals: Array.isArray(parsed.selectedGoals) ? parsed.selectedGoals : [],
                };
            } catch {
                return createInitialOnboardingData();
            }
        }
        return createInitialOnboardingData();
    });

    const [currentStep, setCurrentStep] = useState(data.currentStep);
    const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

    // Save progress to localStorage
    useEffect(() => {
        const toSave = { ...data, currentStep };
        localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(toSave));
    }, [data, currentStep]);

    const updateData = useCallback((updates: Partial<OnboardingData>) => {
        setData(prev => ({ ...prev, ...updates }));
    }, []);

    const handleNext = useCallback(() => {
        if (currentStep < STEPS.length - 1) {
            setDirection('forward');
            const newCompletedSteps = [...new Set([...data.completedSteps, currentStep])];
            updateData({ completedSteps: newCompletedSteps });
            setCurrentStep(prev => prev + 1);
        }
    }, [currentStep, data.completedSteps, updateData]);

    const handleBack = useCallback(() => {
        if (currentStep > 0) {
            setDirection('backward');
            setCurrentStep(prev => prev - 1);
        }
    }, [currentStep]);

    const handleSkip = useCallback(() => {
        if (STEPS[currentStep]?.skippable) {
            handleNext();
        }
    }, [currentStep, handleNext]);

    const handleComplete = useCallback(() => {
        const completedData = {
            ...data,
            completedAt: new Date().toISOString(),
            completedSteps: [...new Set([...data.completedSteps, currentStep])],
        };
        localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        onComplete(completedData);
    }, [data, currentStep, onComplete]);

    const handleStepClick = useCallback((stepIndex: number) => {
        // Only allow clicking on completed steps or the current step
        // Handle empty completedSteps array by defaulting to currentStep
        const maxAllowedStep = data.completedSteps.length > 0
            ? Math.max(...data.completedSteps, currentStep)
            : currentStep;
        if (stepIndex <= maxAllowedStep) {
            setDirection(stepIndex > currentStep ? 'forward' : 'backward');
            setCurrentStep(stepIndex);
        }
    }, [data.completedSteps, currentStep]);

    if (!isOpen) return null;

    const CurrentStepComponent = STEPS[currentStep].component;
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === STEPS.length - 1;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#FFCC00]/5 rounded-full blur-[200px]" />
            </div>

            <div className="neu-raised rounded-[2.5rem] w-full max-w-3xl overflow-hidden relative border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 sm:px-8 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01] shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2">
                            {STEPS.map((step, index) => {
                                const isCompleted = data.completedSteps.includes(index);
                                const isCurrent = index === currentStep;
                                // Handle empty completedSteps array by defaulting to currentStep
                                const maxAllowedStep = data.completedSteps.length > 0
                                    ? Math.max(...data.completedSteps, currentStep)
                                    : currentStep;
                                const isClickable = index <= maxAllowedStep;

                                return (
                                    <button
                                        key={step.id}
                                        onClick={() => handleStepClick(index)}
                                        disabled={!isClickable}
                                        className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 text-xs font-bold",
                                            isCompleted && !isCurrent
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : isCurrent
                                                    ? "cba-gold-gradient text-[#0a0a0f] shadow-lg cba-gold-glow"
                                                    : "neu-inset text-zinc-600",
                                            isClickable && !isCurrent && "cursor-pointer hover:scale-110",
                                            !isClickable && "cursor-not-allowed"
                                        )}
                                        title={step.title}
                                    >
                                        {isCompleted && !isCurrent ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            index + 1
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Mobile step indicator */}
                        <div className="sm:hidden flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-400">
                                Step {currentStep + 1} of {STEPS.length}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="neu-raised-sm p-2 rounded-xl text-zinc-500 hover:text-red-400 btn-press"
                        aria-label="Close wizard"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress bar (mobile) */}
                <div className="sm:hidden px-6 py-2 bg-white/[0.01]">
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full cba-gold-gradient transition-all duration-500 ease-out"
                            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    <div
                        key={currentStep}
                        className={cn(
                            "animate-in duration-300",
                            direction === 'forward'
                                ? "slide-in-from-right-8 fade-in"
                                : "slide-in-from-left-8 fade-in"
                        )}
                    >
                        <CurrentStepComponent
                            data={data}
                            updateData={updateData}
                            onNext={isLastStep ? handleComplete : handleNext}
                            onBack={handleBack}
                            onSkip={STEPS[currentStep].skippable ? handleSkip : undefined}
                            isFirstStep={isFirstStep}
                            isLastStep={isLastStep}
                        />
                    </div>
                </div>

                {/* Footer Navigation */}
                {currentStep !== 0 && currentStep !== STEPS.length - 1 && (
                    <div className="px-6 sm:px-8 py-5 bg-white/[0.01] border-t border-white/5 flex items-center justify-between shrink-0">
                        <button
                            onClick={handleBack}
                            disabled={isFirstStep}
                            className={cn(
                                "flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                                isFirstStep
                                    ? "opacity-30 cursor-not-allowed text-zinc-600"
                                    : "neu-raised-sm text-zinc-400 hover:text-zinc-200 btn-press"
                            )}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Back</span>
                        </button>

                        <div className="flex items-center gap-3">
                            {STEPS[currentStep].skippable && (
                                <button
                                    onClick={handleSkip}
                                    className="px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    Skip
                                </button>
                            )}

                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 px-6 py-3 cba-gold-gradient text-[#0a0a0f] font-bold text-xs uppercase tracking-wider rounded-xl btn-press shadow-lg cba-gold-glow"
                            >
                                <span>Continue</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default OnboardingWizard;
