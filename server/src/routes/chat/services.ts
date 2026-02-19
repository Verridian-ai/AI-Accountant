import { StreamingService } from '../../services/claude/streaming.js';
import { ConfirmationFlowService } from '../../services/claude/confirmation-flow.js';
import { AuditService } from '../../services/claude/audit.js';
import { AmountTagger, TokenMapBuilder } from '../../services/pipeline/index.js';
import { createPgDb } from '../../db/pg-db.js';
import { pool } from '../../schema/connection.js';

const pgDb = createPgDb(pool);

export const streamingService = new StreamingService();
export const confirmationFlow = new ConfirmationFlowService(pgDb);
export const auditService = new AuditService(pgDb);
// AmountTagger uses lazy Redis connect (safe even when USE_NEON=false)
export const amountTagger = new AmountTagger(process.env.REDIS_URL);
export const tokenMapBuilder = new TokenMapBuilder();
export const USE_NEON_RUNTIME = process.env.USE_NEON === 'true';
