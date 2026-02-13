import {
  Calculator, PieChart, Tag, Landmark, FileText, Briefcase,
  Users, TrendingUp, ShieldCheck, Search, BarChart3, Building2,
  Scan, CreditCard, LineChart, ClipboardCheck, Receipt, Truck,
  Banknote, Network
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentResponseCardProps {
  agentType: string;
  answer: string;
  data?: unknown;
  suggestedFollowups?: string[];
  onFollowupClick?: (followup: string) => void;
}

const AGENT_DISPLAY: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  gst_calculator:       { label: 'GST Calculator',       icon: Calculator,    color: 'text-emerald-400' },
  budget_analyzer:      { label: 'Budget Analyzer',      icon: PieChart,      color: 'text-blue-400' },
  transaction_categorizer: { label: 'Categorizer',       icon: Tag,           color: 'text-violet-400' },
  tax_strategy:         { label: 'Tax Strategy',         icon: Landmark,      color: 'text-amber-400' },
  financial_reporting:  { label: 'Financial Reports',    icon: FileText,      color: 'text-cyan-400' },
  payroll_agent:        { label: 'Payroll',              icon: Briefcase,     color: 'text-orange-400' },
  statement_parser:     { label: 'Statement Parser',     icon: Scan,          color: 'text-teal-400' },
  account_reconciler:   { label: 'Reconciler',           icon: ClipboardCheck,color: 'text-lime-400' },
  cross_account_tracer: { label: 'Cross-Account Tracer', icon: Network,       color: 'text-pink-400' },
  merchant_intelligence:{ label: 'Merchant Intel',       icon: Search,        color: 'text-indigo-400' },
  personal_tax_claims:  { label: 'Tax Claims',           icon: Receipt,       color: 'text-yellow-400' },
  financial_planner:    { label: 'Financial Planner',    icon: TrendingUp,    color: 'text-sky-400' },
  inventory_agent:      { label: 'Inventory',            icon: Truck,         color: 'text-rose-400' },
  bank_reconciler_agent:{ label: 'Bank Reconciler',      icon: Banknote,      color: 'text-green-400' },
  asset_management:     { label: 'Asset Management',     icon: Building2,     color: 'text-purple-400' },
  multi_entity:         { label: 'Multi-Entity',         icon: Users,         color: 'text-fuchsia-400' },
  ocr_processing:       { label: 'OCR Processing',       icon: Scan,          color: 'text-slate-400' },
  payment_matching:     { label: 'Payment Matching',     icon: CreditCard,    color: 'text-red-400' },
  forecasting:          { label: 'Forecasting',          icon: LineChart,     color: 'text-emerald-300' },
  compliance_monitoring:{ label: 'Compliance',           icon: ShieldCheck,   color: 'text-amber-300' },
  budgeting:            { label: 'Budgeting',            icon: BarChart3,     color: 'text-blue-300' },
};

const DEFAULT_AGENT = { label: 'AI Agent', icon: Briefcase, color: 'text-zinc-400' };

export function AgentResponseCard({ agentType, answer, suggestedFollowups, onFollowupClick }: AgentResponseCardProps) {
  const agent = AGENT_DISPLAY[agentType] ?? DEFAULT_AGENT;
  const Icon = agent.icon;

  return (
    <div className="space-y-2">
      {/* Agent badge */}
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3 w-3', agent.color)} />
        <span className={cn('text-[8px] font-black uppercase tracking-widest', agent.color)}>
          {agent.label}
        </span>
      </div>

      {/* Answer text */}
      <p className="leading-relaxed font-medium text-xs whitespace-pre-wrap">{answer}</p>

      {/* Follow-up suggestions */}
      {suggestedFollowups && suggestedFollowups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {suggestedFollowups.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFollowupClick?.(f)}
              className="neu-inset px-2.5 py-1 rounded-lg text-[9px] font-bold text-zinc-400 hover:text-[#FFCC00] transition-colors uppercase tracking-wider"
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
