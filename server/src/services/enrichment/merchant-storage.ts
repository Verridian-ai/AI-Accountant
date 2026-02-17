/**
 * Enrichment — Merchant mapping storage logic.
 * Stores new merchant mappings in both local DB and Cognee.
 */

import { db, merchantMemory } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { cogneeClient } from '../cognee_client.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

/**
 * Store a new merchant mapping in both local DB and Cognee.
 * Checks for duplicates before inserting. Persists ABN and industry fields.
 */
export async function storeMerchantMapping(
  userId: string,
  mapping: {
    abbreviatedName: string;
    canonicalName: string;
    abn?: string;
    gstRegistered: boolean;
    industry?: string;
    defaultCategory: string;
  },
): Promise<void> {
  try {
    // Check if pattern already exists (prevents Cognee append-only duplication)
    const existing = await db
      .select()
      .from(merchantMemory)
      .where(
        and(
          eq(merchantMemory.userId, userId),
          eq(merchantMemory.merchantPattern, mapping.abbreviatedName.toLowerCase()),
        ),
      )
      .get();

    if (existing) {
      // Update existing
      await db
        .update(merchantMemory)
        .set({
          merchantDisplayName: mapping.canonicalName,
          category: mapping.defaultCategory,
          gstApplicable: mapping.gstRegistered,
          timesUsed: (existing.timesUsed || 0) + 1,
          lastUsed: new Date().toISOString(),
        })
        .where(eq(merchantMemory.id, existing.id));
    } else {
      // Insert new
      await db.insert(merchantMemory).values({
        id: crypto.randomUUID(),
        userId,
        merchantPattern: mapping.abbreviatedName.toLowerCase(),
        merchantDisplayName: mapping.canonicalName,
        category: mapping.defaultCategory,
        gstApplicable: mapping.gstRegistered,
        timesUsed: 1,
        lastUsed: new Date().toISOString(),
        isUserConfirmed: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Only store to Cognee if the mapping is new (prevents append-only duplication)
    if (!existing) {
      await cogneeClient.storeMerchantMapping(
        mapping.abbreviatedName,
        mapping.canonicalName,
        mapping.abn,
        mapping.gstRegistered,
        mapping.industry,
        mapping.defaultCategory,
      );
    }
  } catch (err) {
    logger.warn({ err }, '[Enrichment] Failed to store merchant mapping');
  }
}
