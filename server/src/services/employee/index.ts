/**
 * Employee Service — Barrel Export
 *
 * Wraps the standalone functions back into the EmployeeService class
 * to preserve the original public API.
 */

import {
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
  terminateEmployee,
  getEmployeeInternal,
  maskSensitiveFields,
} from './employee-crud.js';

import {
  addBankDetails,
  getBankDetails,
  getBankDetailsInternal,
  addSuperFund,
  getSuperFund,
  submitTaxDeclaration,
  getTaxDeclaration,
} from './employee-details.js';

export class EmployeeService {
  async createEmployee(...args: Parameters<typeof createEmployee>) {
    return createEmployee(...args);
  }

  async getEmployee(...args: Parameters<typeof getEmployee>) {
    return getEmployee(...args);
  }

  async listEmployees(...args: Parameters<typeof listEmployees>) {
    return listEmployees(...args);
  }

  async updateEmployee(...args: Parameters<typeof updateEmployee>) {
    return updateEmployee(...args);
  }

  async terminateEmployee(...args: Parameters<typeof terminateEmployee>) {
    return terminateEmployee(...args);
  }

  async addBankDetails(...args: Parameters<typeof addBankDetails>) {
    return addBankDetails(...args);
  }

  async getBankDetails(...args: Parameters<typeof getBankDetails>) {
    return getBankDetails(...args);
  }

  async getBankDetailsInternal(...args: Parameters<typeof getBankDetailsInternal>) {
    return getBankDetailsInternal(...args);
  }

  async addSuperFund(...args: Parameters<typeof addSuperFund>) {
    return addSuperFund(...args);
  }

  async getSuperFund(...args: Parameters<typeof getSuperFund>) {
    return getSuperFund(...args);
  }

  async submitTaxDeclaration(...args: Parameters<typeof submitTaxDeclaration>) {
    return submitTaxDeclaration(...args);
  }

  async getTaxDeclaration(...args: Parameters<typeof getTaxDeclaration>) {
    return getTaxDeclaration(...args);
  }

  private maskSensitiveFields(employee: Record<string, unknown>): Record<string, unknown> {
    return maskSensitiveFields(employee);
  }

  async getEmployeeInternal(...args: Parameters<typeof getEmployeeInternal>) {
    return getEmployeeInternal(...args);
  }
}

export const employeeService = new EmployeeService();
