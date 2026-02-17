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
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: env('DATABASE_URL', 'file:local.db'),
  port: Number(env('PORT', '3000')),
  jwtSecret: env('JWT_SECRET', 'dev-secret'),
  corsOrigin: env('CORS_ORIGIN', '*'),
  nodeEnv: env('NODE_ENV', 'development'),
};
