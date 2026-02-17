/**
 * User Management — Feature Flag Operations
 */

import crypto from 'crypto';
import { db } from '../../schema.js';
import { featureFlags, type FeatureFlag } from '../../db/admin-schema.js';
import { eq } from 'drizzle-orm';
import type { CreateFeatureFlagInput, FeatureFlagUpdate } from './types.js';
import { logActivity } from './activity-log.js';

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  return db.select().from(featureFlags).all();
}

export async function getFeatureFlag(flagName: string): Promise<FeatureFlag | null> {
  return db.select().from(featureFlags).where(eq(featureFlags.flagName, flagName)).get() ?? null;
}

export async function isFeatureEnabled(
  flagName: string,
  cache: Map<string, { value: boolean; expiresAt: number }>,
): Promise<boolean> {
  // Check cache first
  const cached = cache.get(flagName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const flag = await getFeatureFlag(flagName);
  if (!flag) {
    cache.set(flagName, { value: false, expiresAt: Date.now() + 60_000 });
    return false;
  }

  let enabled = flag.isEnabled;
  if (enabled && flag.rolloutPercentage < 100) {
    // Simple deterministic rollout based on flag name hash
    const hash = Array.from(flagName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    enabled = hash % 100 < flag.rolloutPercentage;
  }

  cache.set(flagName, { value: enabled, expiresAt: Date.now() + 60_000 });
  return enabled;
}

export async function updateFeatureFlag(
  flagName: string,
  updates: FeatureFlagUpdate,
  updatedBy: string,
  cache: Map<string, { value: boolean; expiresAt: number }>,
): Promise<FeatureFlag> {
  const existing = await getFeatureFlag(flagName);
  if (!existing) throw new Error(`Feature flag '${flagName}' not found`);

  const updateData: Record<string, any> = {
    updatedBy,
    updatedAt: new Date().toISOString(),
  };
  if (updates.isEnabled !== undefined) updateData.isEnabled = updates.isEnabled;
  if (updates.rolloutPercentage !== undefined)
    updateData.rolloutPercentage = updates.rolloutPercentage;
  if (updates.conditions !== undefined) updateData.conditions = JSON.stringify(updates.conditions);

  await db.update(featureFlags).set(updateData).where(eq(featureFlags.flagName, flagName)).run();

  // Clear cache
  cache.delete(flagName);

  logActivity({
    userId: updatedBy,
    action: 'feature_flag.update',
    resourceType: 'feature_flag',
    resourceId: existing.id,
    details: { flagName, changes: updates },
    status: 'success',
  }).catch(() => {});

  return (await getFeatureFlag(flagName))!;
}

export async function createFeatureFlag(
  data: CreateFeatureFlagInput,
  createdBy: string,
): Promise<FeatureFlag> {
  const existing = await getFeatureFlag(data.flagName);
  if (existing) throw new Error(`Feature flag '${data.flagName}' already exists`);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(featureFlags)
    .values({
      id,
      flagName: data.flagName,
      displayName: data.displayName,
      description: data.description ?? null,
      isEnabled: data.isEnabled,
      rolloutPercentage: data.rolloutPercentage ?? 0,
      conditions: JSON.stringify({}),
      category: data.category,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  logActivity({
    userId: createdBy,
    action: 'feature_flag.create',
    resourceType: 'feature_flag',
    resourceId: id,
    details: { flagName: data.flagName },
    status: 'success',
  }).catch(() => {});

  return (await getFeatureFlag(data.flagName))!;
}
