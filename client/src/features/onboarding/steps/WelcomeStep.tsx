import { Activity, ArrowRight, Sparkles, Shield, Zap, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingStepProps } from '../types';

export function WelcomeStep({ onNext }: OnboardingStepProps) {
  return (
    <div className="p-6 sm:p-10 flex flex-col items-center text-center">
      {/* Hero Icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-[#FFCC00] blur-3xl opacity-20 animate-pulse-glow rounded-full" />
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 neu-raised rounded-[2rem] flex items-center justify-center border border-[#FFCC00]/20">
          <Activity className="w-12 h-12 sm:w-16 sm:h-16 text-[#FFCC00]" />
        </div>
        <div className="absolute -right-2 -top-2 p-2 cba-gold-gradient rounded-xl shadow-lg animate-float">
          <Sparkles className="w-4 h-4 text-[#0a0a0f]" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
        <span className="text-gradient-gold">Welcome to CBA AI</span>
      </h1>
      <p className="text-lg sm:text-xl text-zinc-400 font-medium mb-2">Statement Parser</p>
      <p className="text-sm text-zinc-500 max-w-md mb-10">
        Transform your bank statements into actionable financial insights with AI-powered analysis.
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-10">
        <FeatureCard
          icon={Brain}
          title="AI Categorization"
          description="Automatic transaction classification"
          delay={0}
        />
        <FeatureCard
          icon={Zap}
          title="Instant Insights"
          description="Real-time spending analysis"
          delay={100}
        />
        <FeatureCard
          icon={Shield}
          title="Tax Ready"
          description="BAS & deduction tracking"
          delay={200}
        />
      </div>

      {/* CTA Button */}
      <button
        onClick={onNext}
        className={cn(
          'group flex items-center gap-3 px-8 py-4',
          'cba-gold-gradient text-[#0a0a0f] font-black text-sm uppercase tracking-[0.15em]',
          'rounded-2xl btn-press shadow-xl cba-gold-glow',
          'transition-all duration-300 hover:scale-105',
        )}
      >
        <span>Get Started</span>
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </button>

      <p className="text-xs text-zinc-600 mt-6">Takes about 2 minutes to complete</p>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}

function FeatureCard({ icon: Icon, title, description, delay }: FeatureCardProps) {
  return (
    <div
      className={cn(
        'neu-raised-sm p-5 rounded-2xl text-left border border-white/5',
        'animate-in fade-in slide-in-from-bottom-4 duration-500',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="neu-inset p-2 rounded-xl w-fit mb-3 text-[#FFCC00]">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-bold text-zinc-200 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500">{description}</p>
    </div>
  );
}

export default WelcomeStep;
