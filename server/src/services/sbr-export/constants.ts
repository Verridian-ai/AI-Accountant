import path from 'path';

export const VALID_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

export const SBR_NAMESPACES = {
  sbr: 'http://sbr.gov.au/ato/activity.statement.2023',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  common: 'http://sbr.gov.au/comn/sbr.02.00.data',
  party: 'http://sbr.gov.au/rprt/party.details.01.00.data',
};

export const DEFAULT_EXPORT_DIR = path.join(process.cwd(), 'exports', 'sbr');
