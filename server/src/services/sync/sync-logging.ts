/**
 * Sync Service — Logging functions for sync operations and conflicts.
 */

import crypto from 'crypto';
import { db, offlineSyncLog } from '../../schema.js';
import type { SyncOperation } from './types.js';

/** Log a successful sync or error */
export async function logSync(
  userId: string,
  tenantId: string,
  op: SyncOperation,
  status: string,
  errorMessage?: string,
): Promise<void> {
  await db
    .insert(offlineSyncLog)
    .values({
      id: crypto.randomUUID(),
      userId,
      tenantId,
      deviceId: op.deviceId,
      operation: op.operation,
      resourceType: op.resourceType,
      resourceId: op.resourceId ?? null,
      payloadJson: JSON.stringify(op.payload),
      syncStatus: status,
      syncedAt: new Date().toISOString(),
      errorMessage: errorMessage ?? null,
      clientVersion: op.clientVersion ?? null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    })
    .run();
}

/** Log a conflict for later resolution */
export async function logConflict(
  userId: string,
  tenantId: string,
  op: SyncOperation,
  serverVersion: number,
): Promise<void> {
  await db
    .insert(offlineSyncLog)
    .values({
      id: crypto.randomUUID(),
      userId,
      tenantId,
      deviceId: op.deviceId,
      operation: op.operation,
      resourceType: op.resourceType,
      resourceId: op.resourceId ?? null,
      payloadJson: JSON.stringify(op.payload),
      syncStatus: 'conflict',
      conflictDetails: JSON.stringify({
        reason: 'version_mismatch',
        clientVersion: op.clientVersion,
        serverVersion,
      }),
      serverVersion,
      clientVersion: op.clientVersion ?? null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    })
    .run();
}
