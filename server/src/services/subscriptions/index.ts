/**
 * Subscription Service — Barrel Export
 *
 * Wraps standalone functions into the SubscriptionService class
 * to preserve the original public API.
 */

export type {
  SubscriptionPlan,
  Subscription,
  UsageMetric,
  UsageReport,
  UsageStatus,
  UsageJson,
} from './types.js';
export { UsageLimitExceededError } from './types.js';

import { getPlans, getPlan, getPlanByName, getCurrentSubscription } from './subscription-plans.js';
import {
  subscribe,
  upgrade,
  downgrade,
  cancel,
  reactivate,
  getSubscriptionHistory,
} from './subscription-lifecycle.js';
import {
  trackUsage,
  getUsage,
  resetMonthlyUsage,
  checkUsage,
  enforceLimit,
  isFeatureEnabled,
} from './subscription-usage.js';

import type { UsageMetric } from './types.js';

export class SubscriptionService {
  async getPlans() {
    return getPlans();
  }
  async getPlan(planId: string) {
    return getPlan(planId);
  }
  async getPlanByName(name: string) {
    return getPlanByName(name);
  }

  async subscribe(tenantId: string, planName: string, billingCycle?: 'monthly' | 'annual') {
    return subscribe(tenantId, planName, billingCycle);
  }
  async upgrade(tenantId: string, newPlanName: string) {
    return upgrade(tenantId, newPlanName);
  }
  async downgrade(tenantId: string, newPlanName: string) {
    return downgrade(tenantId, newPlanName);
  }
  async cancel(tenantId: string) {
    return cancel(tenantId);
  }
  async reactivate(tenantId: string) {
    return reactivate(tenantId);
  }
  async getCurrentSubscription(tenantId: string) {
    return getCurrentSubscription(tenantId);
  }
  async getSubscriptionHistory(tenantId: string) {
    return getSubscriptionHistory(tenantId);
  }

  async trackUsage(tenantId: string, metric: UsageMetric, increment?: number) {
    return trackUsage(tenantId, metric, increment);
  }
  async getUsage(tenantId: string) {
    return getUsage(tenantId);
  }
  async resetMonthlyUsage(tenantId: string) {
    return resetMonthlyUsage(tenantId);
  }
  async checkUsage(tenantId: string, metric: UsageMetric) {
    return checkUsage(tenantId, metric);
  }
  async enforceLimit(tenantId: string, metric: UsageMetric) {
    return enforceLimit(tenantId, metric);
  }
  async isFeatureEnabled(tenantId: string, feature: string) {
    return isFeatureEnabled(tenantId, feature);
  }
}

export const subscriptionService = new SubscriptionService();
