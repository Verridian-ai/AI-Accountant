import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentRoutingIndicatorProps {
  agentType?: string;
  isProcessing: boolean;
}

const AGENT_LABELS: Record<string, string> = {
  gst_calculator: 'GST Calculator',
  budget_analyzer: 'Budget Analyzer',
  transaction_categorizer: 'Categorizer',
  tax_strategy: 'Tax Strategy',
  financial_reporting: 'Financial Reports',
  payroll_agent: 'Payroll',
  statement_parser: 'Statement Parser',
  account_reconciler: 'Reconciler',
  cross_account_tracer: 'Cross-Account Tracer',
  merchant_intelligence: 'Merchant Intel',
  personal_tax_claims: 'Tax Claims',
  financial_planner: 'Financial Planner',
  inventory_agent: 'Inventory',
  bank_reconciler_agent: 'Bank Reconciler',
  asset_management: 'Asset Management',
  multi_entity: 'Multi-Entity',
  ocr_processing: 'OCR Processing',
  payment_matching: 'Payment Matching',
  forecasting: 'Forecasting',
  compliance_monitoring: 'Compliance',
  budgeting: 'Budgeting',
};

export function AgentRoutingIndicator({ agentType, isProcessing }: AgentRoutingIndicatorProps) {
  if (!isProcessing) return null;

  const label = agentType ? (AGENT_LABELS[agentType] ?? agentType) : 'Routing';

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 transition-opacity duration-300',
        isProcessing ? 'opacity-100' : 'opacity-0',
      )}
    >
      <Loader2 className="h-3 w-3 text-[#FFCC00] animate-spin" />
      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}
