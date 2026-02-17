import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, userSettings, businessProfiles } from '../schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import {
  validateABN,
  normalizeABN,
  formatABN,
  validateEntityType,
  validateBasFrequency,
  validateAnzsicCode,
  validateTaxAgentNumber,
  ENTITY_TYPES,
  BAS_FREQUENCIES,
  COMMON_ANZSIC_CODES,
} from '../utils/abn.js';

const updateSettingsSchema = z.object({
  modelParsingText: z.string().optional(),
  modelParsingVision: z.string().optional(),
  modelCategorization: z.string().optional(),
  modelChat: z.string().optional(),
  modelEmbedding: z.string().optional(),
}).passthrough();

const businessProfileSchema = z.object({
  abn: z.string().optional(),
  entityType: z.string().optional(),
  entityName: z.string().optional(),
  basFrequency: z.string().optional(),
  industryCode: z.string().optional(),
  taxAgentNumber: z.string().optional(),
  gstRegistered: z.boolean().optional(),
}).passthrough();


const settingsRoutes = new Hono();

// Get user settings
settingsRoutes.get('/settings', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  let settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

  if (!settings) {
    // Create default settings if not exists
    const defaultSettings = {
      userId,
      modelParsingText: 'google/gemini-3-flash-preview',
      modelParsingVision: 'google/gemini-3-flash-preview',
      modelCategorization: 'google/gemini-3-flash-preview',
      modelChat: 'google/gemini-3-flash-preview',
      modelEmbedding: 'openai/text-embedding-3-large',
    };
    await db.insert(userSettings).values(defaultSettings);
    settings = defaultSettings;
  }

  return c.json(settings);
});

// Update user settings
settingsRoutes.patch('/settings', zValidator('json', updateSettingsSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const body = c.req.valid('json');

  await db.update(userSettings).set(body).where(eq(userSettings.userId, userId));

  const updated = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  return c.json(updated);
});

// ============================================================================
// BUSINESS PROFILE ENDPOINTS
// ============================================================================

// Get business profile for current user
settingsRoutes.get('/business-profile', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;

  const profile = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, userId))
    .get();

  if (!profile) {
    // Return empty profile structure (not created yet)
    return c.json({
      exists: false,
      profile: null,
      entityTypes: ENTITY_TYPES,
      basFrequencies: BAS_FREQUENCIES,
      commonIndustryCodes: COMMON_ANZSIC_CODES,
    });
  }

  return c.json({
    exists: true,
    profile: {
      ...profile,
      abnFormatted: profile.abn ? formatABN(profile.abn) : null,
    },
    entityTypes: ENTITY_TYPES,
    basFrequencies: BAS_FREQUENCIES,
    commonIndustryCodes: COMMON_ANZSIC_CODES,
  });
});

// Create or update business profile
settingsRoutes.post('/business-profile', zValidator('json', businessProfileSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const body = c.req.valid('json');

  const validationErrors: string[] = [];

  // Validate ABN if provided
  let normalizedABN: string | null = null;
  if (body.abn && body.abn.trim() !== '') {
    const abnValidation = validateABN(body.abn);
    if (!abnValidation.isValid) {
      validationErrors.push(abnValidation.error || 'Invalid ABN');
    } else {
      normalizedABN = normalizeABN(body.abn);
    }
  }

  // Validate entity type
  if (body.entityType && !validateEntityType(body.entityType)) {
    validationErrors.push(
      `Invalid entity type. Must be one of: ${Object.keys(ENTITY_TYPES).join(', ')}`,
    );
  }

  // Validate BAS frequency
  if (body.basFrequency && !validateBasFrequency(body.basFrequency)) {
    validationErrors.push(
      `Invalid BAS frequency. Must be one of: ${Object.keys(BAS_FREQUENCIES).join(', ')}`,
    );
  }

  // Validate industry code if provided
  if (body.industryCode && !validateAnzsicCode(body.industryCode)) {
    validationErrors.push('Industry code must be a 4-digit ANZSIC code');
  }

  // Validate tax agent number if provided
  if (body.taxAgentNumber && !validateTaxAgentNumber(body.taxAgentNumber)) {
    validationErrors.push('Tax Agent Number must be 7-8 digits');
  }

  // Return validation errors if any
  if (validationErrors.length > 0) {
    return c.json(
      {
        error: 'Validation failed',
        validationErrors,
      },
      400,
    );
  }

  const now = new Date().toISOString();

  // Check if profile exists
  const existing = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, userId))
    .get();

  const profileData = {
    abn: normalizedABN,
    entityType: body.entityType || 'individual',
    businessName: body.businessName || null,
    legalName: body.legalName || null,
    gstRegistered: body.gstRegistered ?? false,
    gstRegistrationDate: body.gstRegistrationDate || null,
    basFrequency: body.basFrequency || 'quarterly',
    accountingMethod: body.accountingMethod || 'cash',
    taxAgentNumber: body.taxAgentNumber?.replace(/\s+/g, '') || null,
    taxAgentName: body.taxAgentName || null,
    industryCode: body.industryCode || null,
    industryDescription: body.industryDescription || null,
    businessAddress: body.businessAddress ? JSON.stringify(body.businessAddress) : null,
    businessPhone: body.businessPhone || null,
    businessEmail: body.businessEmail || null,
    financialYearEnd: body.financialYearEnd || '06-30',
    updatedAt: now,
  };

  if (existing) {
    // Update existing profile
    await db.update(businessProfiles).set(profileData).where(eq(businessProfiles.userId, userId));
  } else {
    // Create new profile
    await db.insert(businessProfiles).values({
      id: crypto.randomUUID(),
      userId,
      ...profileData,
      createdAt: now,
    });
  }

  // Fetch and return updated profile
  const updatedProfile = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, userId))
    .get();

  return c.json({
    success: true,
    profile: {
      ...updatedProfile,
      abnFormatted: updatedProfile?.abn ? formatABN(updatedProfile.abn) : null,
    },
  });
});

// Validate ABN endpoint (for real-time validation in UI)
settingsRoutes.post('/validate-abn', async (c) => {
  const { abn } = await c.req.json();

  if (!abn) {
    return c.json({ isValid: false, error: 'ABN is required' });
  }

  const result = validateABN(abn);
  return c.json(result);
});

// Get reference data (entity types, BAS frequencies, industry codes)
settingsRoutes.get('/business-profile/reference-data', async (c) => {
  return c.json({
    entityTypes: ENTITY_TYPES,
    basFrequencies: BAS_FREQUENCIES,
    commonIndustryCodes: COMMON_ANZSIC_CODES,
  });
});

export default settingsRoutes;