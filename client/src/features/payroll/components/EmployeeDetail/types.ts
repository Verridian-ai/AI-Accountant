export type DetailTab = 'personal' | 'bank' | 'super' | 'tax' | 'pay' | 'documents';

export interface EmployeeDetailProps {
  employeeId: string;
  onBack: () => void;
}

export interface EmployeeRecord {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  tfn_masked?: string;
  employment_status?: string;
  employment_type?: string;
  [key: string]: unknown;
}

export interface BankDetailRecord {
  bsb?: string;
  bsb_masked?: string;
  account_number?: string;
  account_number_masked?: string;
  account_name?: string;
  split_percentage?: number;
}

export interface SuperFundRecord {
  fund_name?: string;
  fund_abn?: string;
  usi?: string;
  member_number?: string;
  contribution_rate?: number;
}

export interface TaxDeclarationRecord {
  tax_free_threshold?: boolean;
  has_help_debt?: boolean;
  has_sfss_debt?: boolean;
  tax_offset_claimed?: boolean;
  dependants?: number;
}

export interface PayStructureRecord {
  category_name?: string;
  pay_category_id?: string;
  rate_type?: string;
  rate_cents?: number;
  standard_hours?: number;
}
