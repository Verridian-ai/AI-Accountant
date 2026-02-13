/**
 * Tenant Routing Agent — Type Definitions
 */

import type { TenantContext } from '../../tenant-types.js';

export interface TenantRoutingInput {
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  requestedPermissions?: string[];
  requestedResources?: Array<{ type: string; ids: string[] }>;
  endpoint?: string;
}

export interface TenantRoutingOutput {
  tenantContext: TenantContext;
  permissionsGranted: Record<string, boolean>;
  isolationViolations: Array<{
    resourceType: string;
    resourceId: string;
    reason: string;
  }>;
  rateLimitStatus: {
    allowed: boolean;
    remaining: number;
    resetAt: string;
  };
}
