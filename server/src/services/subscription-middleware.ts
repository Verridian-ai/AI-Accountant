/**
 * Subscription Middleware
 * Hono middleware for enforcing subscription limits and feature gates on routes.
 */

import type { Context, Next } from 'hono';
import { subscriptionService } from './subscriptions.js';
import { UsageLimitExceededError } from './subscription-types.js';
import type { UsageMetric } from './subscription-types.js';

/**
 * Middleware that checks whether the tenant has capacity for the given usage metric.
 * Returns HTTP 402 (Payment Required) if the tenant's plan limit is exceeded.
 *
 * Expects `X-Tenant-Id` header or `tenantId` query param.
 */
export function subscriptionLimitMiddleware(metric: UsageMetric) {
  return async (c: Context, next: Next): Promise<void | Response> => {
    const tenantId = c.req.header('X-Tenant-Id') ?? c.req.query('tenantId');
    if (!tenantId) {
      return c.json({ error: 'Missing tenant context (X-Tenant-Id header required)' }, 400);
    }

    try {
      await subscriptionService.enforceLimit(tenantId, metric);
    } catch (err) {
      if (err instanceof UsageLimitExceededError) {
        return c.json(
          {
            error: 'Usage limit exceeded',
            message: err.message,
            metric: err.metric,
            current: err.current,
            limit: err.limit,
            plan: err.planName,
            upgradeUrl: '/settings/subscription',
          },
          402,
        );
      }
      throw err;
    }

    await next();
  };
}

/**
 * Middleware that checks whether a feature is enabled for the tenant's plan.
 * Returns HTTP 403 (Forbidden) if the feature is not included.
 *
 * Expects `X-Tenant-Id` header or `tenantId` query param.
 */
export function featureGateMiddleware(feature: string) {
  return async (c: Context, next: Next): Promise<void | Response> => {
    const tenantId = c.req.header('X-Tenant-Id') ?? c.req.query('tenantId');
    if (!tenantId) {
      return c.json({ error: 'Missing tenant context (X-Tenant-Id header required)' }, 400);
    }

    const enabled = await subscriptionService.isFeatureEnabled(tenantId, feature);
    if (!enabled) {
      return c.json(
        {
          error: 'Feature not available',
          message: `The "${feature}" feature is not included in your current plan. Upgrade to access this feature.`,
          feature,
          upgradeUrl: '/settings/subscription',
        },
        403,
      );
    }

    await next();
  };
}
