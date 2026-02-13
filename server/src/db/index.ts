/**
 * Database entry point - exports correct schema and db based on environment
 *
 * In production (NODE_ENV=production): Uses PostgreSQL
 * In development: Uses SQLite
 */

import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL || 'file:sqlite.db';
const usePostgres =
  isProduction || dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

console.log(
  `[DB] Environment: ${isProduction ? 'production' : 'development'}, Using: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`,
);

// Export based on environment
// Note: We use dynamic imports via require for CommonJS compatibility with the build
if (usePostgres) {
  console.log('[DB] Loading PostgreSQL schema and connection');
  module.exports = require('./postgres-exports');
} else {
  console.log('[DB] Loading SQLite schema');
  module.exports = require('../schema-sqlite');
}
