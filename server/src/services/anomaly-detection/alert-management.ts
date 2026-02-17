/**
 * Anomaly Detection Module — Alert Management (CRUD & Stats)
 *
 * Handles persistence, retrieval, and lifecycle of anomaly alerts.
 */

import { db, anomalyAlerts } from '../../schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type { AlertFilters, AlertStats } from './types.js';

export class AlertManagement {
  async getAlerts(userId: string, filters?: AlertFilters): Promise<any[]> {
    const conditions: any[] = [eq(anomalyAlerts.userId, userId)];
    if (filters?.status) conditions.push(eq(anomalyAlerts.status, filters.status));
    if (filters?.severity) conditions.push(eq(anomalyAlerts.severity, filters.severity));
    if (filters?.alertType) conditions.push(eq(anomalyAlerts.alertType, filters.alertType));
    if (filters?.dateFrom) conditions.push(gte(anomalyAlerts.createdAt, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(anomalyAlerts.createdAt, filters.dateTo));
    return db
      .select()
      .from(anomalyAlerts)
      .where(and(...conditions))
      .orderBy(desc(anomalyAlerts.createdAt))
      .all();
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await db
      .update(anomalyAlerts)
      .set({ status: 'acknowledged' })
      .where(eq(anomalyAlerts.id, alertId))
      .run();
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    await db
      .update(anomalyAlerts)
      .set({ status: 'resolved', resolvedBy, resolvedAt: new Date().toISOString() })
      .where(eq(anomalyAlerts.id, alertId))
      .run();
  }

  async dismissAlert(alertId: string, reason: string): Promise<void> {
    await db
      .update(anomalyAlerts)
      .set({ status: 'dismissed', resolvedBy: reason })
      .where(eq(anomalyAlerts.id, alertId))
      .run();
  }

  async getAlertStats(userId: string): Promise<AlertStats> {
    const allAlerts: any[] = await db
      .select()
      .from(anomalyAlerts)
      .where(eq(anomalyAlerts.userId, userId))
      .all();
    const byType: Record<string, number> = {},
      bySeverity: Record<string, number> = {},
      byStatus: Record<string, number> = {};
    for (const alert of allAlerts) {
      byType[alert.alertType] = (byType[alert.alertType] ?? 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] ?? 0) + 1;
      byStatus[alert.status] = (byStatus[alert.status] ?? 0) + 1;
    }
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const thirtyStr = thirtyDaysAgo.toISOString();
    const sixtyStr = sixtyDaysAgo.toISOString();
    const recentCount = allAlerts.filter((a: any) => a.createdAt >= thirtyStr).length;
    const priorCount = allAlerts.filter(
      (a: any) => a.createdAt >= sixtyStr && a.createdAt < thirtyStr,
    ).length;
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (recentCount > priorCount * 1.2) trend = 'increasing';
    else if (recentCount < priorCount * 0.8) trend = 'decreasing';
    return { total: allAlerts.length, byType, bySeverity, byStatus, trend };
  }
}
