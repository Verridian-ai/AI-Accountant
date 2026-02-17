/**
 * Application config — centralises env-var access for the server.
 *
 * Importing files:
 *   db/index.ts      — uses config.isProduction, config.databaseUrl
 *   routes/payroll.ts — uses config (generic)
 *   services/auth/auth-service.ts — uses requireEnv('JWT_SECRET')
 */
import dotenv from 'dotenv';
dotenv.config();

function env(key: string, fallback?: string): string {
  return process.env[key] ?? fallback ?? '';
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  // Core
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: env('DATABASE_URL', 'file:local.db'),
  port: Number(env('PORT', '3000')),
  jwtSecret: env('JWT_SECRET', 'dev-secret'),
  corsOrigin: env('CORS_ORIGIN', '*'),
  nodeEnv: env('NODE_ENV', 'development'),
  appUrl: env('APP_URL', 'http://localhost:5173'),

  // Admin
  adminDefaultPassword: env('ADMIN_DEFAULT_PASSWORD', ''),
  adminJwtSecret: env('ADMIN_JWT_SECRET', ''),
  tenantJwtSecret: env('TENANT_JWT_SECRET', ''),

  // AI / LLM
  openrouterBaseUrl: env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
  openaiBaseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
  openrouterApiKey: env('OPENROUTER_API_KEY', ''),
  openaiApiKey: env('OPENAI_API_KEY', ''),
  viteOpenrouterApiKey: env('VITE_OPENROUTER_API_KEY', ''),
  viteOpenaiApiKey: env('VITE_OPENAI_API_KEY', ''),
  anthropicApiKey: env('ANTHROPIC_API_KEY', ''),

  // Google / Vertex AI
  vertexAiApiKey: env('VERTEX_AI_API_KEY', ''),
  gcpProjectId: env('GCP_PROJECT_ID', ''),
  gcpRegion: env('GCP_REGION', 'us-central1'),

  // Infrastructure
  redisUrl: env('REDIS_URL', ''),
  cogneeApiUrl: env('COGNEE_API_URL', 'http://localhost:8000'),

  // Stripe
  stripeSecretKey: env('STRIPE_SECRET_KEY', ''),
  stripeProPriceId: env('STRIPE_PRO_PRICE_ID', ''),
  stripeBusinessPriceId: env('STRIPE_BUSINESS_PRICE_ID', ''),

  // Push notifications (VAPID)
  vapidPublicKey: env('VAPID_PUBLIC_KEY', ''),
  vapidPrivateKey: env('VAPID_PRIVATE_KEY', ''),
  vapidSubject: env('VAPID_SUBJECT', 'mailto:support@goldledger.com.au'),

  // Data services
  alphaVantageApiKey: env('ALPHA_VANTAGE_API_KEY', ''),
  schedulerEnabled: env('SCHEDULER_ENABLED', 'true'),
  encryptionKey: env('ENCRYPTION_KEY', ''),

  // Thresholds
  apAutoMatchThreshold: Number(env('AP_AUTO_MATCH_THRESHOLD', '0.02')),
};
