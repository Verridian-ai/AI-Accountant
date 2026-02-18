/**
 * Rate Limiter Service — barrel re-export.
 */
export type { RateLimitResult, RateLimitConfig, WindowCounter } from './types.js';
export { TenantRateLimiter, tenantRateLimiter } from './tenant-rate-limiter.js';
