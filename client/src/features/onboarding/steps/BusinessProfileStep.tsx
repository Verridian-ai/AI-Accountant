import { useState } from 'react';
import { Building2, User, Users, Briefcase, Shield, HelpCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OnboardingStepProps } from '../types';
import { ENTITY_TYPES, INDUSTRIES } from '../types';

const ENTITY_ICONS: Record<string, React.ElementType> = {
  individual: User,
  sole_trader: Briefcase,
  company: Building2,
  partnership: Users,
  trust: Shield,
};

export function BusinessProfileStep({ data, updateData }: OnboardingStepProps) {
  const [abnError, setAbnError] = useState<string | null>(null);

  const validateABN = (abn: string): boolean => {
    // Remove spaces and validate format
    const cleaned = abn.replace(/\s/g, '');
    if (!cleaned) return true; // Allow empty
    if (!/^\d{11}$/.test(cleaned)) {
      setAbnError('ABN must be 11 digits');
      return false;
    }
    // Basic ABN validation algorithm
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;
    const digits = cleaned.split('').map(Number);
    digits[0] = digits[0]! - 1;
    const sum = digits.reduce((acc, digit, i) => acc + digit * weights[i]!, 0);
    if (sum % 89 !== 0) {
      setAbnError('Invalid ABN checksum');
      return false;
    }
    setAbnError(null);
    return true;
  };

  const handleABNChange = (value: string) => {
    // Format with spaces: XX XXX XXX XXX
    const cleaned = value.replace(/\D/g, '').slice(0, 11);
    const formatted = cleaned.replace(/(\d{2})(\d{3})?(\d{3})?(\d{3})?/, (_, a, b, c, d) => {
      let result = a;
      if (b) result += ' ' + b;
      if (c) result += ' ' + c;
      if (d) result += ' ' + d;
      return result;
    });
    updateData({ abn: formatted });
    if (cleaned.length === 11) {
      validateABN(cleaned);
    } else {
      setAbnError(null);
    }
  };

  const showBusinessFields = data.entityType !== 'individual';

  return (
    <div className="p-6 sm:p-10 space-y-8">
      {/* Header */}
      <div className="text-center sm:text-left">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
          <span className="text-gradient-gold">Tell us about yourself</span>
        </h2>
        <p className="text-sm text-muted">
          This helps us customize your experience and tax calculations.
        </p>
      </div>

      {/* Entity Type Selection */}
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
          Entity Type
          <HelpCircle className="w-3 h-3 text-zinc-600" />
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {ENTITY_TYPES.map((type) => {
            const Icon = ENTITY_ICONS[type.id] || Building2;
            const isSelected = data.entityType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => updateData({ entityType: type.id as typeof data.entityType })}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all btn-press text-center',
                  isSelected
                    ? 'cba-gold-gradient text-base border-transparent shadow-lg cba-gold-glow'
                    : 'neu-raised-sm border-border/50 text-secondary hover:text-primary hover:border-border',
                )}
                aria-pressed={isSelected}
              >
                <Icon className={cn('w-6 h-6', isSelected ? 'text-base' : 'text-muted')} />
                <span className="font-bold text-xs uppercase tracking-tight">{type.label}</span>
                {isSelected && <Check className="w-4 h-4 absolute top-2 right-2" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Business Name */}
      {showBusinessFields && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">
            Business Name
          </label>
          <Input
            type="text"
            value={data.businessName}
            onChange={(e) => updateData({ businessName: e.target.value })}
            placeholder="e.g., Acme Consulting Pty Ltd"
            className="w-full px-5 py-4 neu-inset rounded-2xl focus-gold outline-none text-primary font-medium text-sm placeholder-zinc-700 transition-all bg-transparent border-border"
          />
        </div>
      )}

      {/* ABN */}
      {showBusinessFields && (
        <div
          className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300"
          style={{ animationDelay: '50ms' }}
        >
          <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
            ABN
            <span className="text-zinc-600 font-normal normal-case tracking-normal">
              (optional)
            </span>
          </label>
          <Input
            type="text"
            value={data.abn}
            onChange={(e) => handleABNChange(e.target.value)}
            placeholder="XX XXX XXX XXX"
            className={cn(
              'w-full px-5 py-4 neu-inset rounded-2xl focus-gold outline-none text-cba-gold font-mono font-bold text-sm placeholder-zinc-700 transition-all bg-transparent',
              abnError ? 'border-red-500/50' : 'border-border',
            )}
          />
          {abnError && <p className="text-xs text-red-400 ml-1">{abnError}</p>}
        </div>
      )}

      {/* Industry */}
      <div className="space-y-3" style={{ animationDelay: '100ms' }}>
        <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">
          {showBusinessFields ? 'Industry' : 'Primary Income Source'}
        </label>
        <Select value={data.industry} onValueChange={(value) => updateData({ industry: value })}>
          <SelectTrigger className="w-full px-5 py-4 h-auto neu-inset rounded-2xl text-sm font-medium">
            <SelectValue placeholder="Select an industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((industry) => (
              <SelectItem key={industry} value={industry}>
                {industry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Info Box */}
      <div className="neu-inset rounded-2xl p-5 border border-cba-gold/10 bg-cba-gold/[0.02]">
        <p className="text-xs text-secondary leading-relaxed">
          <span className="text-cba-gold font-bold">Why do we ask?</span> Your entity type affects
          tax calculations, GST obligations, and the categories we suggest.
          {showBusinessFields
            ? ' For businesses, your ABN helps with BAS preparation and invoice generation.'
            : ' Individuals get simplified tracking focused on personal finance management.'}
        </p>
      </div>
    </div>
  );
}

export default BusinessProfileStep;
