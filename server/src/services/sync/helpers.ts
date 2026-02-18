/**
 * Sync Service — Helper/conversion functions.
 */

import type { ServerConflict, SyncLogEntry } from './types.js';

/** Safely parse JSON from a string or return the value if already parsed */
export function parsePayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(raw as string);
  } catch {
    return {};
  }
}

/** Convert raw row to ServerConflict */
export function rowToConflict(row: Record<string, unknown>): ServerConflict {
  return {
    id: row.id as string,
    deviceId: (row.deviceId ?? row.device_id) as string,
    operation: row.operation as string,
    resourceType: (row.resourceType ?? row.resource_type) as string,
    resourceId: (row.resourceId ?? row.resource_id) as string | undefined,
    payload: parsePayload(row.payloadJson ?? row.payload_json),
    conflictDetails: (row.conflictDetails ?? row.conflict_details) as string | undefined,
    serverVersion: (row.serverVersion ?? row.server_version) as number | undefined,
    clientVersion: (row.clientVersion ?? row.client_version) as number | undefined,
    createdAt: (row.createdAt ?? row.created_at) as string | undefined,
  };
}

/** Convert raw row to SyncLogEntry */
export function rowToLogEntry(row: Record<string, unknown>): SyncLogEntry {
  return {
    id: row.id as string,
    deviceId: (row.deviceId ?? row.device_id) as string,
    operation: row.operation as string,
    resourceType: (row.resourceType ?? row.resource_type) as string,
    resourceId: (row.resourceId ?? row.resource_id) as string | undefined,
    syncStatus: ((row.syncStatus ?? row.sync_status) as string) ?? 'pending',
    conflictResolution: (row.conflictResolution ?? row.conflict_resolution) as string | undefined,
    errorMessage: (row.errorMessage ?? row.error_message) as string | undefined,
    createdAt: (row.createdAt ?? row.created_at) as string | undefined,
    syncedAt: (row.syncedAt ?? row.synced_at) as string | undefined,
  };
}
