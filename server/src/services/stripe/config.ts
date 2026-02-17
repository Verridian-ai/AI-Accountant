/**
 * Stripe Plan Configuration
 *
 * Defines plan tiers, pricing, limits, and features.
 */

import { config } from '../../lib/config.js';

// Plan configuration
export const PLAN_CONFIG = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    limits: {
      statementsPerMonth: 5,
      historyMonths: 6,
      maxAccounts: 2,
      teamSeats: 0,
    },
    features: {
      basicParsing: true,
      advancedCategorization: false,
      taxReporting: false,
      multiBank: false,
      apiAccess: false,
      prioritySupport: false,
      customCategories: false,
      exportFormats: ['csv'],
      ragSearch: false,
    },
  },
  pro: {
    name: 'Pro',
    price: 2900, // $29/month in cents
    priceId: config.stripeProPriceId,
    limits: {
      statementsPerMonth: 50,
      historyMonths: 24, // 2 years
      maxAccounts: 10,
      teamSeats: 0,
    },
    features: {
      basicParsing: true,
      advancedCategorization: true,
      taxReporting: true,
      multiBank: true,
      apiAccess: false,
      prioritySupport: false,
      customCategories: true,
      exportFormats: ['csv', 'xlsx', 'pdf'],
      ragSearch: true,
    },
  },
  business: {
    name: 'Business',
    price: 7900, // $79/month in cents
    priceId: config.stripeBusinessPriceId,
    limits: {
      statementsPerMonth: -1, // Unlimited
      historyMonths: -1, // Unlimited
      maxAccounts: -1, // Unlimited
      teamSeats: 5,
    },
    features: {
      basicParsing: true,
      advancedCategorization: true,
      taxReporting: true,
      multiBank: true,
      apiAccess: true,
      prioritySupport: true,
      customCategories: true,
      exportFormats: ['csv', 'xlsx', 'pdf', 'json'],
      ragSearch: true,
    },
  },
} as const;
