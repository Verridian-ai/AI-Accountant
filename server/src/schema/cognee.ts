import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';

// ============================================================================
// COGNEE MULTI-USER
// ============================================================================

export const cogneeUserAccounts = sqliteTable('cognee_user_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  cogneeEmail: text('cognee_email').notNull(),
  cogneeRefreshToken: text('cognee_refresh_token'), // Encrypted refresh token, NOT password (D02 CRIT-03)
  cogneeUserId: text('cognee_user_id'),
  datasetPrefix: text('dataset_prefix').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cogneeSessions = sqliteTable('cognee_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionType: text('session_type').notNull().default('chat'),
  cogneeSessionId: text('cognee_session_id'),
  state: text('state').notNull().default('active'),
  contextData: text('context_data'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  lastActivityAt: text('last_activity_at').notNull().default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at').notNull(),
});

// ============================================================================
// WAVE 16: Cognee DataPoints, Graph Schemas & Feedback
// ============================================================================

export const datapointConfigs = sqliteTable('datapoint_configs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  datapointType: text('datapoint_type').notNull(),
  schemaDefinition: text('schema_definition').notNull(),
  extractionPrompt: text('extraction_prompt'),
  datasetName: text('dataset_name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isPredefined: integer('is_predefined', { mode: 'boolean' }).default(false),
  extractionCount: integer('extraction_count').default(0),
  lastExtractionAt: text('last_extraction_at'),
  accuracyScore: real('accuracy_score'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const graphSchemas = sqliteTable('graph_schemas', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  ontologyType: text('ontology_type').notNull(),
  nodeTypes: text('node_types').notNull(),
  edgeTypes: text('edge_types').notNull(),
  constraints: text('constraints'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isPredefined: integer('is_predefined', { mode: 'boolean' }).default(false),
  appliedDatasets: text('applied_datasets'),
  version: integer('version').default(1),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cogneeFeedback = sqliteTable('cognee_feedback', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  feedbackType: text('feedback_type').notNull(),
  originalValue: text('original_value'),
  correctedValue: text('corrected_value'),
  context: text('context'),
  datapointConfigId: text('datapoint_config_id'),
  appliedToMemify: integer('applied_to_memify', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// RAG & KNOWLEDGE
// ============================================================================

export const ragNamespaces = sqliteTable('rag_namespaces', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  chunkCount: integer('chunk_count').default(0),
  embeddingModel: text('embedding_model'),
  embeddingDimensions: integer('embedding_dimensions'),
  documentCount: integer('document_count'),
  lastIndexedAt: text('last_indexed_at'),
  status: text('status'),
  settings: text('settings'),
  lastUpdated: text('last_updated').notNull().default('CURRENT_TIMESTAMP'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const ragChunks = sqliteTable('rag_chunks', {
  id: text('id').primaryKey(),
  namespaceId: text('namespace_id')
    .notNull()
    .references(() => ragNamespaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull(),
  chunkType: text('chunk_type').notNull(),
  metadata: text('metadata'),
  embedding: text('embedding'),
  sourceId: text('source_id'),
  sourceType: text('source_type'),
  documentId: text('document_id'),
  category: text('category'),
  accountId: text('account_id'),
  dateStart: text('date_start'),
  dateEnd: text('date_end'),
  contentTokens: integer('content_tokens'),
  totalAmount: integer('total_amount'),
  transactionCount: integer('transaction_count'),
  merchantNormalized: text('merchant_normalized'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const ragDocuments = sqliteTable('rag_documents', {
  id: text('id').primaryKey(),
  namespaceId: text('namespace_id')
    .notNull()
    .references(() => ragNamespaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id'),
  version: integer('version').notNull().default(1),
  chunkCount: integer('chunk_count').default(0),
  status: text('status').notNull().default('indexed'),
  contentHash: text('content_hash'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const ragCitations = sqliteTable('rag_citations', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  queryId: text('query_id').notNull(),
  chunkId: text('chunk_id')
    .notNull()
    .references(() => ragChunks.id, { onDelete: 'cascade' }),
  relevanceScore: real('relevance_score'),
  usedInResponse: integer('used_in_response', { mode: 'boolean' }).default(false),
  documentId: text('document_id'),
  rerankScore: real('rerank_score'),
  position: integer('position'),
  excerptUsed: text('excerpt_used'),
  wasHelpful: integer('was_helpful', { mode: 'boolean' }),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Type exports
export type CogneeUserAccount = typeof cogneeUserAccounts.$inferSelect;
export type NewCogneeUserAccount = typeof cogneeUserAccounts.$inferInsert;
export type CogneeSession = typeof cogneeSessions.$inferSelect;
export type NewCogneeSession = typeof cogneeSessions.$inferInsert;
export type RagNamespace = typeof ragNamespaces.$inferSelect;
export type RagChunk = typeof ragChunks.$inferSelect;
export type RagDocument = typeof ragDocuments.$inferSelect;
export type RagCitation = typeof ragCitations.$inferSelect;
