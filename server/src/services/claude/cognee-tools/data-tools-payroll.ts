/**
 * Cognee Tools — Payroll Domain Data Methods (Wave 4)
 *
 * Extracted from data-tools.ts: employee profile indexing/search
 * and pay structure indexing/search.
 */

import type { CogneeClient } from '../../cognee_client.js';
import type { CogneeToolConfig } from './types.js';
import { COGNEE_DATASETS } from './types.js';

/**
 * Index employee profile data for NL queries (Wave 4).
 */
export async function indexEmployee(
  config: CogneeToolConfig,
  client: CogneeClient,
  prefixDataset: (dataset: string) => string,
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    employmentType: string;
    status: string;
    startDate: string;
  },
  userId?: string,
): Promise<void> {
  const dataset = prefixDataset(COGNEE_DATASETS.employeeProfiles);
  const data = [
    `Employee: ${employee.firstName} ${employee.lastName}`,
    `Email: ${employee.email ?? 'not provided'}`,
    `Type: ${employee.employmentType}`,
    `Status: ${employee.status}`,
    `Start Date: ${employee.startDate}`,
    `Employee ID: ${employee.id}`,
  ].join('\n');

  await client.add([data], dataset, userId ?? config.userId, config.tenantId);
}

/**
 * Index pay structure data for NL queries (Wave 4).
 */
export async function indexPayStructure(
  config: CogneeToolConfig,
  client: CogneeClient,
  prefixDataset: (dataset: string) => string,
  structure: {
    employeeName: string;
    categoryName: string;
    rate: number; // cents
    rateType: string;
    hoursPerWeek?: number;
    annualSalary?: number; // cents
  },
  userId?: string,
): Promise<void> {
  const dataset = prefixDataset(COGNEE_DATASETS.payStructures);
  const rateDollars = (structure.rate / 100).toFixed(2);
  const salaryDollars = structure.annualSalary ? (structure.annualSalary / 100).toFixed(2) : 'N/A';

  const data = [
    `Employee: ${structure.employeeName}`,
    `Pay Category: ${structure.categoryName}`,
    `Rate: $${rateDollars} (${structure.rateType})`,
    `Hours/Week: ${structure.hoursPerWeek ?? 'N/A'}`,
    `Annual Salary: $${salaryDollars}`,
  ].join('\n');

  await client.add([data], dataset, userId ?? config.userId, config.tenantId);
}

/**
 * Search employees by name or attribute (Wave 4).
 */
export async function searchEmployees(
  config: CogneeToolConfig,
  client: CogneeClient,
  prefixDataset: (dataset: string) => string,
  query: string,
  topK: number = 5,
  userId?: string,
): Promise<string[]> {
  const dataset = prefixDataset(COGNEE_DATASETS.employeeProfiles);
  return client.search(
    query,
    dataset,
    topK,
    'CHUNKS_LEXICAL',
    userId ?? config.userId,
    config.tenantId,
  );
}

/**
 * Search pay structures and rates (Wave 4).
 */
export async function searchPayStructures(
  config: CogneeToolConfig,
  client: CogneeClient,
  prefixDataset: (dataset: string) => string,
  query: string,
  topK: number = 5,
  userId?: string,
): Promise<string[]> {
  const dataset = prefixDataset(COGNEE_DATASETS.payStructures);
  return client.search(query, dataset, topK, 'CHUNKS', userId ?? config.userId, config.tenantId);
}
