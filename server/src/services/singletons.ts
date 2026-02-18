/**
 * Shared stateful singletons for server services.
 *
 * Node.js module cache ensures a single instance per process.
 * Import from here to share state across route files.
 */
import { db } from '../schema.js';
import { StreamingService } from './claude/streaming.js';
import { ConfirmationFlowService } from './claude/confirmation-flow.js';
import { AuditService } from './claude/audit.js';
import { SchemaRegistry } from './claude/schemas/schema-registry.js';
import { StreamingRegistry } from './streaming-registry.js';

export const streamingService = new StreamingService();
export const schemaRegistry = new SchemaRegistry();
export const streamingRegistry = new StreamingRegistry();
schemaRegistry.initializeDefaults();

export const confirmationFlow = new ConfirmationFlowService(db);
export const auditService = new AuditService(db);
