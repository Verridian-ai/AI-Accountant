import { User, CreditCard, Shield, FileText, DollarSign } from 'lucide-react';
import type { Step } from './types';

export const STEPS: readonly Step[] = [
  { id: 'personal', label: 'Personal Details', icon: User },
  { id: 'bank', label: 'Bank Details', icon: CreditCard },
  { id: 'super', label: 'Super Fund', icon: Shield },
  { id: 'tax', label: 'Tax Declaration', icon: FileText },
  { id: 'pay', label: 'Pay Structure', icon: DollarSign },
] as const;
