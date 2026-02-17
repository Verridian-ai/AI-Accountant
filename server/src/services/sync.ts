/**
 * Sync Service (Wave 24)
 *
 * Processes offline changes from PWA clients, detects conflicts using
 * version-based optimistic concurrency, and provides conflict resolution.
 *
 * Flow:
 * 1. Client accumulates operations offline (create/update/delete)
 * 2. When online, client sends batch via POST /api/sync
 * 3. Server processes each operation, checking server_version vs client_version
 * 4. Conflicts are logged in offline_sync_log for manual resolution
 * 5. Non-conflicting changes are applied and results returned
 */

import crypto from 'crypto';
import { db, offlineSyncLog, transactions } from '../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface SyncOperation {
  deviceId: string;
  operation: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  clientVersion?: number;
}

export interface ApplyResult {
  success: boolean;
  resourceId?: string;
  error?: string;
  conflict?: boolean;
  serverVersion?: number;
}

export interface SyncResult {
  processed: number;
  applied: number;
  conflicts: number;
  errors: number;
  results: Array<{
    operation: string;
    resourceType: string;
    resourceId?: string;
    status: 'applied' | 'conflict' | 'error';
    error?: string;
    serverVersion?: number;
  }>;
}

export interface ServerConflict {
  id: string;
  deviceId: string;
  operation: string;
  resourceType: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  conflictDetails?: string;
  serverVersion?: number;
  clientVersion?: number;
  createdAt?: string;
}

export interface SyncLogEntry {
  id: string;
  deviceId: string;
  operation: string;
  resourceType: string;
  resourceId?: string;
  syncStatus: string;
  conflictResolution?: string;
  errorMessage?: string;
  createdAt?: string;
  syncedAt?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Safely parse JSON from a string or return the value if already parsed */
function parsePayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(raw as string);
  } catch {
    return {};
  }
}

/** Convert raw row to ServerConflict */
function rowToConflict(row: Record<string, unknown>): ServerConflict {
  return {
    id: String(row.id),
    deviceId: String(row.deviceId ?? row.device_id),
    operation: String(row.operation),
    resourceType: String(row.resourceType ?? row.resource_type),
    resourceId: row.resourceId ?? row.resource_id ? String(row.resourceId ?? row.resource_id) : undefined,
    payload: parsePayload(row.payloadJson ?? row.payload_json),
    conflictDetails: row.conflictDetails ?? row.conflict_details ? String(row.conflictDetails ?? row.conflict_details) : undefined,
    serverVersion: row.serverVersion ?? row.server_version ? Number(row.serverVersion ?? row.server_version) : undefined,
    clientVersion: row.clientVersion ?? row.client_version ? Number(row.clientVersion ?? row.client_version) : undefined,
    createdAt: row.createdAt ?? row.created_at ? String(row.createdAt ?? row.created_at) : undefined,
  };
}

/** Convert raw row to SyncLogEntry */
function rowToLogEntry(row: Record<string, unknown>): SyncLogEntry {
  return {
    id: String(row.id),
    deviceId: String(row.deviceId ?? row.device_id),
    operation: String(row.operation),
    resourceType: String(row.resourceType ?? row.resource_type),
    resourceId: row.resourceId ?? row.resource_id ? String(row.resourceId ?? row.resource_id) : undefined,
    syncStatus: String(row.syncStatus ?? row.sync_status ?? 'pending'),
    conflictResolution: row.conflictResolution ?? row.conflict_resolution ? String(row.conflictResolution ?? row.conflict_resolution) : undefined,
    errorMessage: row.errorMessage ?? row.error_message ? String(row.errorMessage ?? row.error_message) : undefined,
    createdAt: row.createdAt ?? row.created_at ? String(row.createdAt ?? row.created_at) : undefined,
    syncedAt: row.syncedAt ?? row.synced_at ? String(row.syncedAt ?? row.synced_at) : undefined,
  };
}

// ============================================================================
// SYNC SERVICE
// ============================================================================

export class SyncService {
  /**
   * Process a batch of offline operations.
   * Each operation is applied individually; conflicts are recorded.
   */
  async processSync(
    userId: string,
    tenantId: string,
    operations: SyncOperation[],
  ): Promise<SyncResult> {
    const result: SyncResult = {
      processed: 0,
      applied: 0,
      conflicts: 0,
      errors: 0,
      results: [],
    };

    for (const op of operations) {
      result.processed++;

      try {
        // Check for version conflicts on updates/deletes
        if (
          (op.operation === 'update' || op.operation === 'delete') &&
          op.resourceId &&
          op.clientVersion !== undefined
        ) {
          const serverVersion = await this.getServerVersion(op.resourceType, op.resourceId);

          if (serverVersion > 0 && op.clientVersion < serverVersion) {
            // Conflict detected — log it
            await this.logConflict(userId, tenantId, op, serverVersion);
            result.conflicts++;
            result.results.push({
              operation: op.operation,
              resourceType: op.resourceType,
              resourceId: op.resourceId,
              status: 'conflict',
              serverVersion,
            });
            continue;
          }
        }

        // Apply the operation
        const applyResult = await this.applyOperation(op, tenantId);

        if (applyResult.success) {
          // Log successful sync
          await this.logSync(userId, tenantId, op, 'synced');
          result.applied++;
          result.results.push({
            operation: op.operation,
            resourceType: op.resourceType,
            resourceId: applyResult.resourceId ?? op.resourceId,
            status: 'applied',
            serverVersion: applyResult.serverVersion,
          });
        } else {
          await this.logSync(userId, tenantId, op, 'error', applyResult.error);
          result.errors++;
          result.results.push({
            operation: op.operation,
            resourceType: op.resourceType,
            resourceId: op.resourceId,
            status: 'error',
            error: applyResult.error,
          });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        await this.logSync(userId, tenantId, op, 'error', errMsg);
        result.errors++;
        result.results.push({
          operation: op.operation,
          resourceType: op.resourceType,
          resourceId: op.resourceId,
          status: 'error',
          error: errMsg,
        });
      }
    }

    return result;
  }

  /**
   * Get the current server version for a resource.
   * Returns 0 if the resource doesn't exist or has no version tracking.
   */
  async getServerVersion(resourceType: string, resourceId: string): Promise<number> {
    // For transactions, use the updated_at timestamp as a pseudo-version
    if (resourceType === 'transaction') {
      const row = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, String(resourceId)))
        .get();

      if (!row) return 0;

      // Use updatedAt as version (epoch ms)
      const updatedAt = (row as Record<string, unknown>).updatedAt ?? (row as Record<string, unknown>).updated_at ?? (row as Record<string, unknown>).date;
      if (updatedAt) {
        return new Date(String(updatedAt)).getTime();
      }
      return 1; // Exists but no version info
    }

    // For other resource types, return 0 (no version tracking yet)
    return 0;
  }

  /**
   * Apply a single sync operation to the database.
   * Currently supports transactions; extensible to other resource types.
   */
  async applyOperation(op: SyncOperation, tenantId: string): Promise<ApplyResult> {
    try {
      switch (op.resourceType) {
        case 'transaction':
          return this.applyTransactionOp(op, tenantId);
        default:
          return {
            success: false,
            error: `Unsupported resource type: ${op.resourceType}`,
          };
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Apply operation failed',
      };
    }
  }

  /**
   * Apply a transaction operation (create/update/delete).
   */
  private async applyTransactionOp(op: SyncOperation, _tenantId: string): Promise<ApplyResult> {
    const now = new Date().toISOString();
    const payload = op.payload;

    switch (op.operation) {
      case 'create': {
        const newId = (payload.id as string) ?? crypto.randomUUID();
        await db
          .insert(transactions)
          .values({
            id: newId,
            description: (payload.description as string) ?? '',
            amount: (payload.amount as number) ?? 0,
            date: (payload.date as string) ?? now,
            category: (payload.category as string) ?? 'Uncategorised',
            statementId: payload.statementId != null ? String(payload.statementId) : null,
            balance: payload.balance != null ? Number(payload.balance) : null,
            accountId: payload.accountId != null ? String(payload.accountId) : null,
          })
          .run();

        return { success: true, resourceId: newId };
      }

      case 'update': {
        if (!op.resourceId) return { success: false, error: 'resourceId required for update' };

        const setValues: Record<string, unknown> = {};
        if (payload.description !== undefined) setValues.description = payload.description;
        if (payload.amount !== undefined) setValues.amount = payload.amount;
        if (payload.date !== undefined) setValues.date = payload.date;
        if (payload.category !== undefined) setValues.category = payload.category;
        if (payload.type !== undefined) setValues.type = payload.type;

        if (Object.keys(setValues).length === 0) {
          return { success: true, resourceId: op.resourceId };
        }

        await db
          .update(transactions)
          .set(setValues as Record<string, unknown>)
          .where(eq(transactions.id, op.resourceId!))
          .run();

        return { success: true, resourceId: op.resourceId, serverVersion: Date.now() };
      }

      case 'delete': {
        if (!op.resourceId) return { success: false, error: 'resourceId required for delete' };

        await db.delete(transactions).where(eq(transactions.id, op.resourceId!)).run();

        return { success: true, resourceId: op.resourceId };
      }

      default:
        return { success: false, error: `Unknown operation: ${op.operation}` };
    }
  }

  /**
   * Get unresolved conflicts for a user.
   */
  async getConflicts(userId: string, tenantId: string): Promise<ServerConflict[]> {
    const rows = await db
      .select()
      .from(offlineSyncLog)
      .where(
        and(
          eq(offlineSyncLog.userId, userId),
          eq(offlineSyncLog.tenantId, tenantId),
          eq(offlineSyncLog.syncStatus, 'conflict'),
        ),
      )
      .orderBy(desc(offlineSyncLog.createdAt))
      .all();

    return (rows as Array<Record<string, unknown>>).map(rowToConflict);
  }

  /**
   * Resolve a conflict by applying client or server version.
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'client_wins' | 'server_wins',
  ): Promise<void> {
    const conflict = await db
      .select()
      .from(offlineSyncLog)
      .where(eq(offlineSyncLog.id, conflictId))
      .get();

    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const row = conflict as Record<string, unknown>;

    if (resolution === 'client_wins') {
      // Re-apply the client's operation
      const payload = parsePayload(row.payloadJson ?? row.payload_json);
      const op: SyncOperation = {
        deviceId: String(row.deviceId ?? row.device_id),
        operation: row.operation as 'create' | 'update' | 'delete',
        resourceType: String(row.resourceType ?? row.resource_type),
        resourceId: row.resourceId ?? row.resource_id ? String(row.resourceId ?? row.resource_id) : undefined,
        payload,
      };

      const tenantId = String(row.tenantId ?? row.tenant_id);
      await this.applyOperation(op, tenantId);
    }
    // server_wins = do nothing (server state is already correct)

    // Mark conflict as resolved
    await db
      .update(offlineSyncLog)
      .set({
        syncStatus: 'resolved',
        conflictResolution: resolution,
        syncedAt: new Date().toISOString(),
      })
      .where(eq(offlineSyncLog.id, conflictId))
      .run();
  }

  /**
   * Get paginated sync history for a user.
   */
  async getSyncLog(
    userId: string,
    tenantId: string,
    limit = 20,
    offset = 0,
  ): Promise<SyncLogEntry[]> {
    const rows = await db
      .select()
      .from(offlineSyncLog)
      .where(and(eq(offlineSyncLog.userId, userId), eq(offlineSyncLog.tenantId, tenantId)))
      .orderBy(desc(offlineSyncLog.createdAt))
      .all();

    // Manual pagination since SQLite proxy may not support .limit()/.offset() chaining consistently
    return (rows as Array<Record<string, unknown>>).slice(offset, offset + limit).map(rowToLogEntry);
  }

  // --------------------------------------------------------------------------
  // PRIVATE: Logging
  // --------------------------------------------------------------------------

  /** Log a successful sync or error */
  private async logSync(
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
  private async logConflict(
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
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const syncService = new SyncService();
