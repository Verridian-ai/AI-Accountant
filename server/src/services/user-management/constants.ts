/**
 * User Management Service — Constants (Roles & Permissions)
 */

import type { RoleDefinition, PermissionDefinition } from './types.js';

export const ROLES: RoleDefinition[] = [
  {
    role: 'super_admin',
    displayName: 'Super Admin',
    description:
      'Full system access — can manage all users, agents, Cognee, features, and system settings',
    defaultPermissions: [
      'manage_users',
      'manage_agents',
      'manage_cognee',
      'view_metrics',
      'manage_features',
      'trigger_crawl',
      'manage_scheduler',
    ],
  },
  {
    role: 'admin',
    displayName: 'Admin',
    description: 'Operational access — can manage agents, trigger crawls, and view metrics',
    defaultPermissions: ['view_metrics', 'manage_agents', 'trigger_crawl', 'manage_scheduler'],
  },
  {
    role: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access — can view metrics and dashboards',
    defaultPermissions: ['view_metrics'],
  },
];

export const PERMISSIONS: PermissionDefinition[] = [
  {
    permission: 'manage_users',
    displayName: 'Manage Users',
    description: 'Create, update, delete admin users and assign roles',
    category: 'User Management',
  },
  {
    permission: 'manage_agents',
    displayName: 'Manage Agents',
    description: 'Configure, enable/disable, and monitor AI agents',
    category: 'Agent Management',
  },
  {
    permission: 'manage_cognee',
    displayName: 'Manage Cognee',
    description: 'Manage knowledge graph, datasets, ontologies, and Cognee settings',
    category: 'Cognee Management',
  },
  {
    permission: 'view_metrics',
    displayName: 'View Metrics',
    description: 'View system metrics, dashboards, and monitoring data',
    category: 'System Monitoring',
  },
  {
    permission: 'manage_features',
    displayName: 'Manage Features',
    description: 'Toggle feature flags and manage rollout percentages',
    category: 'Feature Flags',
  },
  {
    permission: 'trigger_crawl',
    displayName: 'Trigger Crawl',
    description: 'Trigger knowledge ingestion and data crawling operations',
    category: 'Data Operations',
  },
  {
    permission: 'manage_scheduler',
    displayName: 'Manage Scheduler',
    description: 'Configure scheduled jobs and background task settings',
    category: 'Data Operations',
  },
];

export const VALID_PERMISSIONS = new Set(PERMISSIONS.map((p) => p.permission));
