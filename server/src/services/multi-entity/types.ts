/**
 * Multi-Entity Types
 */

export type EntityType =
  | 'sole_trader'
  | 'company'
  | 'trust'
  | 'partnership'
  | 'smsf'
  | 'individual';
export type AccountRole =
  | 'operating'
  | 'savings'
  | 'loan'
  | 'offset'
  | 'credit_card'
  | 'investment'
  | 'trust'
  | 'super';
export type InterEntityTransactionType =
  | 'loan'
  | 'management_fee'
  | 'dividend'
  | 'distribution'
  | 'rent'
  | 'service_fee'
  | 'asset_transfer'
  | 'capital_contribution';
export type InterEntityStatus = 'pending' | 'confirmed' | 'eliminated' | 'disputed';

export interface Entity {
  id: string;
  userId: string;
  name: string;
  entityType: EntityType;
  abn: string | null;
  acn: string | null;
  tfn: string | null;
  parentEntityId: string | null;
  isConsolidatedParent: boolean;
  financialYearEnd: string;
  reportingCurrency: string;
  status: string;
  address: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntityAccount {
  id: string;
  entityId: string;
  accountId: string;
  role: AccountRole;
  ownershipPercentage: number;
  linkedAt: string;
}

export interface EntitySetting {
  id: string;
  entityId: string;
  basReportingFrequency: string;
  gstRegistered: boolean;
  gstMethod: string;
  taxRate: number | null;
  lodgementDueDates: string | null;
  defaultDepreciationMethod: string;
  instantWriteOffThreshold: number;
  chartOfAccountsTemplate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterEntityTransaction {
  id: string;
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  fromTransactionId: string | null;
  toTransactionId: string | null;
  amount: number;
  description: string | null;
  transactionDate: string;
  transactionType: InterEntityTransactionType;
  status: InterEntityStatus;
  confirmedByFrom: boolean;
  confirmedByTo: boolean;
  eliminationGroupId: string | null;
  notes: string | null;
  createdAt: string;
}

export function validateABN(abn: string): boolean {
  const cleaned = abn.replace(/\s/g, '');
  return /^\d{11}$/.test(cleaned);
}

export function validateACN(acn: string): boolean {
  const cleaned = acn.replace(/\s/g, '');
  return /^\d{9}$/.test(cleaned);
}
