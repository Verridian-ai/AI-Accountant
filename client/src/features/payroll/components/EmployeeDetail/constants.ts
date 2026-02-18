import { User, CreditCard, Shield, FileText, DollarSign, FolderOpen } from 'lucide-react';
import type { DetailTab } from './types.js';

export const tabs: { id: DetailTab; label: string; icon: typeof User }[] = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'bank', label: 'Bank Details', icon: CreditCard },
  { id: 'super', label: 'Super', icon: Shield },
  { id: 'tax', label: 'Tax Declaration', icon: FileText },
  { id: 'pay', label: 'Pay Structure', icon: DollarSign },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
];

export const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Active' },
  terminated: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Terminated' },
  on_leave: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'On Leave' },
};

export const typeLabels: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  casual: 'Casual',
  contractor: 'Contractor',
};

export const SUPER_MIN_RATE = 11.5;
