import type { LucideIcon } from 'lucide-react';

export interface EmployeeOnboardingProps {
  onComplete: () => void;
  onCancel: () => void;
}

export interface PayCategory {
  id: string;
  name: string;
  type: string;
  rateType: string;
  defaultRate: number;
}

export interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
}
