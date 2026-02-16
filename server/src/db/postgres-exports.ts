// Export database instance and schema from postgres-connection and postgres-schema
import { getDb } from './postgres-connection.js';

export const db = getDb();
export * from './postgres-schema.js';
