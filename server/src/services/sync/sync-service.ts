/**
 * Sync Service (Wave 24)
 *
 * Processes offline changes from PWA clients, detects conflicts using
 * version-based optimistic concurrency, and provides conflict resolution.
 */

import crypto from 'crypto';
import { db, offlineSyncLog, transactions } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type {
  SyncOperation,
  ApplyResult,
  SyncResult,
  ServerConflict,
  SyncLogEntry,
} from './types.js';
import { parsePayload, rowToConflict, rowToLogEntry } from './helpers.js';
import { logSync, logConflict } from './sync-logging.js';

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
            // Conflict detected -- log it
            await logConflict(userId, tenantId, op, serverVersion);
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
          await logSync(userId, tenantId, op, 'synced');
          result.applied++;
          result.results.push({
            operation: op.operation,
            resourceType: op.resourceType,
            resourceId: applyResult.resourceId ?? op.resourceId,
            status: 'applied',
            serverVersion: applyResult.serverVersion,
          });
        } else {
          await logSync(userId, tenantId, op, 'error', applyResult.error);
          result.errors++;
          result.results.push({
            operation: op.operation,
            resourceType: op.resourceType,
            resourceId: op.resourceId,
            status: 'error',
            error: applyResult.error,
          });
        }
      } catch (err: any) {
        await logSync(userId, tenantId, op, 'error', err.message ?? 'Unknown error');
        result.errors++;
        result.results.push({
          operation: op.operation,
          resourceType: op.resourceType,
          resourceId: op.resourceId,
          status: 'error',
          error: err.message ?? 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Get the current server version for a resource.
   */
  async getServerVersion(resourceType: string, resourceId: string): Promise<number> {
    if (resourceType === 'transaction') {
      const row = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, String(resourceId)))
        .get();

      if (!row) return 0;

      const updatedAt = (row as any).updatedAt ?? (row as any).updated_at ?? (row as any).date;
      if (updatedAt) {
        return new Date(updatedAt).getTime();
      }
      return 1;
    }

    return 0;
  }

  /**
   * Apply a single sync operation to the database.
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
    } catch (err: any) {
      return {
        success: false,
        error: err.message ?? 'Apply operation failed',
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
          .set(setValues as any)
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

    return (rows as any[]).map(rowToConflict);
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

    const row = conflict as any;

    if (resolution === 'client_wins') {
      const payload = parsePayload(row.payloadJson ?? row.payload_json);
      const op: SyncOperation = {
        deviceId: row.deviceId ?? row.device_id,
        operation: row.operation as 'create' | 'update' | 'delete',
        resourceType: row.resourceType ?? row.resource_type,
        resourceId: row.resourceId ?? row.resource_id,
        payload,
      };

      const tenantId = row.tenantId ?? row.tenant_id;
      await this.applyOperation(op, tenantId);
    }

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

    return (rows as any[]).slice(offset, offset + limit).map(rowToLogEntry);
  }
}

export const syncService = new SyncService();
