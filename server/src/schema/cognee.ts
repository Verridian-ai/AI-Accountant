import { pgTable, text, integer, boolean, doublePrecision } from 'drizzle-orm/pg-core';

// NOTE: .references() to users (core.ts) omitted until core.ts migrates to pgTable (TASK-045).
// DB-level FK constraints remain intact in SQL migration files.

// ============================================================================
// COGNEE MULTI-USER
// ============================================================================

export const cogneeUserAccounts = pgTable('cognee_user_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  cogneeEmail: text('cognee_email').notNull(),
  cogneeRefreshToken: text('cognee_refresh_token'), // Encrypted refresh token, NOT password (D02 CRIT-03)
  cogneeUserId: text('cognee_user_id'),
  datasetPrefix: text('dataset_prefix').notNull(),
  isActive: boolean('is_active').default(true),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cogneeSessions = pgTable('cognee_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
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

export const datapointConfigs = pgTable('datapoint_configs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  name: text('name').notNull(),
  description: text('description'),
  datapointType: text('datapoint_type').notNull(),
  schemaDefinition: text('schema_definition').notNull(),
  extractionPrompt: text('extraction_prompt'),
  datasetName: text('dataset_name').notNull(),
  isActive: boolean('is_active').default(true),
  isPredefined: boolean('is_predefined').default(false),
  extractionCount: integer('extraction_count').default(0),
  lastExtractionAt: text('last_extraction_at'),
  accuracyScore: doublePrecision('accuracy_score'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const graphSchemas = pgTable('graph_schemas', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  name: text('name').notNull(),
  description: text('description'),
  ontologyType: text('ontology_type').notNull(),
  nodeTypes: text('node_types').notNull(),
  edgeTypes: text('edge_types').notNull(),
  constraints: text('constraints'),
  isActive: boolean('is_active').default(true),
  isPredefined: boolean('is_predefined').default(false),
  appliedDatasets: text('applied_datasets'),
  version: integer('version').default(1),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cogneeFeedback = pgTable('cognee_feedback', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  feedbackType: text('feedback_type').notNull(),
  originalValue: text('original_value'),
  correctedValue: text('corrected_value'),
  context: text('context'),
  datapointConfigId: text('datapoint_config_id'),
  appliedToMemify: boolean('applied_to_memify').default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// RAG & KNOWLEDGE
// ============================================================================

export const ragNamespaces = pgTable('rag_namespaces', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
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

export const ragChunks = pgTable('rag_chunks', {
  id: text('id').primaryKey(),
  namespaceId: text('namespace_id').notNull(), // FK → rag_namespaces(id) CASCADE
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
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

export const ragDocuments = pgTable('rag_documents', {
  id: text('id').primaryKey(),
  namespaceId: text('namespace_id').notNull(), // FK → rag_namespaces(id) CASCADE
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
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

export const ragCitations = pgTable('rag_citations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  queryId: text('query_id').notNull(),
  chunkId: text('chunk_id').notNull(), // FK → rag_chunks(id) CASCADE
  relevanceScore: doublePrecision('relevance_score'),
  usedInResponse: boolean('used_in_response').default(false),
  documentId: text('document_id'),
  rerankScore: doublePrecision('rerank_score'),
  position: integer('position'),
  excerptUsed: text('excerpt_used'),
  wasHelpful: boolean('was_helpful'),
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
