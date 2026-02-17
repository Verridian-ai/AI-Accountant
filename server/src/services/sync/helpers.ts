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
export function rowToConflict(row: any): ServerConflict {
  return {
    id: row.id,
    deviceId: row.deviceId ?? row.device_id,
    operation: row.operation,
    resourceType: row.resourceType ?? row.resource_type,
    resourceId: row.resourceId ?? row.resource_id ?? undefined,
    payload: parsePayload(row.payloadJson ?? row.payload_json),
    conflictDetails: row.conflictDetails ?? row.conflict_details ?? undefined,
    serverVersion: row.serverVersion ?? row.server_version ?? undefined,
    clientVersion: row.clientVersion ?? row.client_version ?? undefined,
    createdAt: row.createdAt ?? row.created_at ?? undefined,
  };
}

/** Convert raw row to SyncLogEntry */
export function rowToLogEntry(row: any): SyncLogEntry {
  return {
    id: row.id,
    deviceId: row.deviceId ?? row.device_id,
    operation: row.operation,
    resourceType: row.resourceType ?? row.resource_type,
    resourceId: row.resourceId ?? row.resource_id ?? undefined,
    syncStatus: row.syncStatus ?? row.sync_status ?? 'pending',
    conflictResolution: row.conflictResolution ?? row.conflict_resolution ?? undefined,
    errorMessage: row.errorMessage ?? row.error_message ?? undefined,
    createdAt: row.createdAt ?? row.created_at ?? undefined,
    syncedAt: row.syncedAt ?? row.synced_at ?? undefined,
  };
}
