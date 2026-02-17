/**
 * Compliance Monitor — Risk Assessment
 *
 * Evaluates overall compliance risk for a user based on
 * overdue obligations, anomaly alerts, and schedule configuration.
 */

import { db, anomalyAlerts, complianceSchedules } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { ComplianceObligation, RiskAssessment, RiskFactor, RiskLevel } from './types.js';

/**
 * Assess overall compliance risk for a user.
 */
export async function assessOverallRisk(
  userId: string,
  checkObligationsFn: (userId: string) => Promise<ComplianceObligation[]>,
): Promise<RiskAssessment> {
  const obligations = await checkObligationsFn(userId);
  const factors: RiskFactor[] = [];
  const recommendations: string[] = [];

  const overdue = obligations.filter((o) => o.status === 'overdue');
  const upcoming = obligations.filter((o) => o.status === 'upcoming');
  const overdueCount = overdue.length;
  const upcomingCount = upcoming.length;

  let score = 0;

  for (const o of overdue) {
    const daysOverdue = Math.abs(o.daysUntilDue);
    const severity: RiskLevel =
      daysOverdue > 56 ? 'critical' : daysOverdue > 28 ? 'high' : 'medium';
    const weight = severity === 'critical' ? 25 : severity === 'high' ? 15 : 8;
    score += weight;

    factors.push({
      area: o.obligationType.toUpperCase(),
      severity,
      description: `${o.obligationType.toUpperCase()} for ${o.period} is ${daysOverdue} days overdue (due ${o.dueDate}).`,
      obligation: o.id,
    });

    if (daysOverdue > 28) {
      recommendations.push(
        `Lodge ${o.obligationType.toUpperCase()} for ${o.period} immediately — FTL penalties accrue every 28 days ($330 per period, up to 5 periods).`,
      );
    } else {
      recommendations.push(
        `Lodge ${o.obligationType.toUpperCase()} for ${o.period} as soon as possible to minimise penalties.`,
      );
    }
  }

  for (const o of upcoming) {
    if (o.daysUntilDue <= 7) {
      score += 5;
      factors.push({
        area: o.obligationType.toUpperCase(),
        severity: 'medium',
        description: `${o.obligationType.toUpperCase()} for ${o.period} is due in ${o.daysUntilDue} day(s) (${o.dueDate}).`,
        obligation: o.id,
      });
    }
  }

  const openAlerts: any[] = await db
    .select()
    .from(anomalyAlerts)
    .where(and(eq(anomalyAlerts.userId, userId), eq(anomalyAlerts.status, 'open')))
    .all();

  if (openAlerts.length > 0) {
    const alertScore = Math.min(openAlerts.length * 3, 20);
    score += alertScore;

    const highSeverity = openAlerts.filter(
      (a: any) => a.severity === 'high' || a.severity === 'critical',
    ).length;
    const severity: RiskLevel = highSeverity > 0 ? 'high' : 'medium';

    factors.push({
      area: 'Anomaly Alerts',
      severity,
      description: `${openAlerts.length} open anomaly alert(s) (${highSeverity} high/critical severity).`,
    });

    if (highSeverity > 0) {
      recommendations.push(
        `Review and resolve ${highSeverity} high-severity anomaly alert(s) — these may indicate compliance-relevant irregularities.`,
      );
    }
  }

  const schedules: any[] = await db
    .select()
    .from(complianceSchedules)
    .where(eq(complianceSchedules.userId, userId))
    .all();

  if (schedules.length === 0) {
    score += 10;
    factors.push({
      area: 'Record Keeping',
      severity: 'medium',
      description: 'No compliance schedules configured — obligations may not be tracked.',
    });
    recommendations.push(
      'Set up compliance schedules to automatically track BAS, PAYG, and super deadlines.',
    );
  }

  score = Math.min(score, 100);

  let overallRisk: RiskLevel = 'low';
  if (score >= 70) overallRisk = 'critical';
  else if (score >= 40) overallRisk = 'high';
  else if (score >= 15) overallRisk = 'medium';

  if (overallRisk === 'low' && recommendations.length === 0) {
    recommendations.push(
      'All compliance obligations appear current. Continue monitoring upcoming deadlines.',
    );
  }

  return { overallRisk, score, overdueCount, upcomingCount, factors, recommendations };
}
