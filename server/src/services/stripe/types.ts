/**
 * Stripe Service Types
 *
 * Type definitions for the Stripe payment integration.
 */

import type { PLAN_CONFIG } from './config.js';

export type PlanType = keyof typeof PLAN_CONFIG;
export type PlanFeatures = (typeof PLAN_CONFIG)[PlanType]['features'];
export type PlanLimits = (typeof PLAN_CONFIG)[PlanType]['limits'];

export interface SubscriptionStatus {
  plan: PlanType;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
  usage: {
    statementsThisMonth: number;
    accountsCount: number;
  };
}

export interface WebhookResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}
