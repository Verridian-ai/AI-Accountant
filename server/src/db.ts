import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({ url: 'file:sqlite.db' });
export const db = drizzle(client);

export const statements = sqliteTable('statements', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  hash: text('hash').notNull().unique(),
  uploadDate: text('upload_date').notNull(),
  parsingStatus: text('parsing_status').notNull().default('PENDING'),
  aiModelUsed: text('ai_model_used'),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  balance: integer('balance'),
  category: text('category'),
  gstApplicable: integer('gst_applicable', { mode: 'boolean' }).default(false),
  aiReasoningNotes: text('ai_reasoning_notes'),
  confidenceScore: real('confidence_score').default(1.0),
  statementId: text('statement_id').references(() => statements.id),
});
