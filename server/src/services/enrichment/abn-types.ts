/**
 * ABN Lookup — Types & Constants
 */

export const ABR_BASE_URL = 'https://abr.business.gov.au/abrxmlsearch/abrxmlsearch.asmx';

export interface ABNLookupResult {
  abn: string;
  abnStatus: 'Active' | 'Cancelled';
  isCurrentABN: boolean;
  businessName: string;
  tradingName?: string;
  entityType: string;
  gstRegistered: boolean;
  gstRegistrationDate?: string;
  state?: string;
  postcode?: string;
}
