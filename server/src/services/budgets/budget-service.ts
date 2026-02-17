/**
 * Budget Service
 * Full budget lifecycle management with automated generation from historical data
 * and budget-vs-actual variance analysis.
 */

import type { CreateBudgetParams, CreateBudgetLineParams, VarianceSummary } from './types.js';
import { BudgetCrud } from './budget-crud.js';
import { generateFromHistory } from './budget-generation.js';
import { calculateVariance, getVarianceSummary } from './budget-variance.js';

export class BudgetService {
  private crud = new BudgetCrud();

  // -- CRUD Operations --
  async createBudget(userId: string, params: CreateBudgetParams) {
    return this.crud.createBudget(userId, params);
  }

  async getBudget(budgetId: string) {
    return this.crud.getBudget(budgetId);
  }

  async listBudgets(userId: string, status?: string) {
    return this.crud.listBudgets(userId, status);
  }

  async updateBudget(
    budgetId: string,
    updates: Partial<{ name: string; status: string; periodStart: string; periodEnd: string }>,
  ) {
    return this.crud.updateBudget(budgetId, updates);
  }

  async deleteBudget(budgetId: string): Promise<void> {
    return this.crud.deleteBudget(budgetId);
  }

  // -- Budget Line Operations --
  async addBudgetLine(budgetId: string, line: CreateBudgetLineParams) {
    return this.crud.addBudgetLine(budgetId, line);
  }

  async updateBudgetLine(
    lineId: string,
    updates: Partial<{ budgetedAmount: number; notes: string }>,
  ) {
    return this.crud.updateBudgetLine(lineId, updates);
  }

  async deleteBudgetLine(lineId: string): Promise<void> {
    return this.crud.deleteBudgetLine(lineId);
  }

  // -- Auto-Generation --
  async generateFromHistory(
    userId: string,
    periodStart: string,
    periodEnd: string,
    lookbackMonths: number,
    budgetId?: string,
  ) {
    return generateFromHistory(userId, periodStart, periodEnd, lookbackMonths, budgetId);
  }

  // -- Budget vs Actual --
  async calculateVariance(budgetId: string) {
    return calculateVariance(budgetId);
  }

  async getVarianceSummary(budgetId: string): Promise<VarianceSummary> {
    return getVarianceSummary(budgetId);
  }
}

export const budgetService = new BudgetService();
