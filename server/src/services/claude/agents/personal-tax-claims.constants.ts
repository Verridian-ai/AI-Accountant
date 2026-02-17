/**
 * Personal Tax Claims Agent — Claim Pattern Constants
 *
 * Patterns that indicate potentially claimable expenses by category,
 * matching ATO deduction categories to transaction descriptions.
 */

import type { PersonalTaxClaimsOutput } from '../types.js';

/** Patterns that indicate potentially claimable expenses by category */
export const CLAIM_PATTERNS: Array<{
  claimType: PersonalTaxClaimsOutput['claims'][number]['claimType'];
  patterns: RegExp[];
  categories: string[];
}> = [
  {
    claimType: 'wfh',
    patterns: [/\bINTERNET\b/i, /\bELECTRICITY\b/i, /\bOFFICE\s*WORKS\b/i, /\bSTATIONERY\b/i],
    categories: ['Communication & Internet', 'Utilities', 'Office Supplies'],
  },
  {
    claimType: 'motor_vehicle',
    patterns: [
      /\bFUEL\b/i,
      /\bPETROL\b/i,
      /\bSHELL\b/i,
      /\bBP\b/i,
      /\bCALTEX\b/i,
      /\bAMPOL\b/i,
      /\bREGO\b/i,
      /\bINSURANCE.*CAR\b/i,
    ],
    categories: ['Motor Vehicle Expenses'],
  },
  {
    claimType: 'tools',
    patterns: [
      /\bBUNNINGS\b/i,
      /\bTOOL\b/i,
      /\bSOFTWARE\b/i,
      /\bADOBE\b/i,
      /\bMICROSOFT\b/i,
      /\bAPPLE\b/i,
    ],
    categories: ['Equipment & Tools', 'Subscriptions'],
  },
  {
    claimType: 'uniforms',
    patterns: [/\bUNIFORM\b/i, /\bPROTECTIVE\b/i, /\bSAFETY\b/i, /\bWORKWEAR\b/i, /\bLAUNDRY\b/i],
    categories: [],
  },
  {
    claimType: 'self_education',
    patterns: [
      /\bCOURSE\b/i,
      /\bTRAINING\b/i,
      /\bUDEMY\b/i,
      /\bCOURSERA\b/i,
      /\bTEXTBOOK\b/i,
      /\bCONFERENCE\b/i,
    ],
    categories: ['Education & Training'],
  },
  {
    claimType: 'travel',
    patterns: [
      /\bFLIGHT\b/i,
      /\bQANTAS\b/i,
      /\bVIRGIN\b/i,
      /\bJETSTAR\b/i,
      /\bHOTEL\b/i,
      /\bACCOM\b/i,
      /\bAIRBNB\b/i,
    ],
    categories: ['Travel & Accommodation'],
  },
  {
    claimType: 'phone_internet',
    patterns: [
      /\bTELSTRA\b/i,
      /\bOPTUS\b/i,
      /\bVODAFONE\b/i,
      /\bTPG\b/i,
      /\bNBN\b/i,
      /\bPHONE\b/i,
      /\bMOBILE\b/i,
    ],
    categories: ['Communication & Internet'],
  },
];
