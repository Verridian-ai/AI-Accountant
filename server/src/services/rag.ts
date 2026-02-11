/**
 * RAG Service — Cognee-backed knowledge graph for transactions.
 *
 * Delegates all HTTP calls to cogneeClient (the single source of truth).
 * Adds USE_COGNEE gate, transaction formatting, and cognify triggers.
 */

import { logger } from '../utils/logger.js';
import { cogneeClient } from './cognee_client.js';
import type { CogneeSearchType } from './cognee_client.js';

const USE_COGNEE = process.env.USE_COGNEE === 'true';

export class RAGService {
    /**
     * Index transactions into Cognee knowledge graph.
     * Converts transactions to text, uploads via cogneeClient, then triggers cognify
     * with the bank_transactions dataset name (not empty body).
     */
    async indexTransactions(transactions: unknown[]) {
        if (!USE_COGNEE) return null;

        const lines = (transactions as any[]).map(tx =>
            `Date: ${tx.date}, Description: ${tx.description}, Amount: $${(tx.amount / 100).toFixed(2)}, Category: ${tx.category}, Notes: ${tx.aiReasoningNotes || 'N/A'}`
        );

        logger.info(`[RAG] Indexing ${lines.length} transactions in Cognee...`);

        try {
            await cogneeClient.add(lines, 'bank_transactions');

            logger.info('[RAG] Triggering cognify for bank_transactions dataset...');
            await cogneeClient.cognify(['bank_transactions'], true);
            logger.info('[RAG] Cognee cognify triggered in background');
            return { status: 'ok' };
        } catch (err) {
            logger.error('[RAG] Cognee indexing failed', err);
            return null;
        }
    }

    /**
     * Add documents to Cognee knowledge base.
     */
    async addDocuments(documents: string[], datasetName: string = 'knowledge_base') {
        if (!USE_COGNEE) return null;
        return cogneeClient.add(documents, datasetName);
    }

    /**
     * Search Cognee knowledge graph with configurable search type.
     * Defaults to GRAPH_COMPLETION for context-aware answers.
     */
    async search(
        query: string,
        _model?: string,
        searchType: CogneeSearchType = 'GRAPH_COMPLETION'
    ) {
        if (!USE_COGNEE) return { results: [] };

        logger.info(`[RAG] Searching Cognee (${searchType}): "${query}"`);
        const results = await cogneeClient.search(query, 'bank_transactions', 10, searchType);

        return { results };
    }

    /**
     * Multi-type search: combines CHUNKS (direct matches) + GRAPH_SUMMARY_COMPLETION
     * (contextual analysis) for richer chat context.
     */
    async searchMulti(query: string): Promise<{ chunks: string[]; summary: string[] }> {
        if (!USE_COGNEE) return { chunks: [], summary: [] };

        logger.info(`[RAG] Multi-search Cognee: "${query}"`);

        const [chunks, summary] = await Promise.all([
            cogneeClient.search(query, 'bank_transactions', 5, 'CHUNKS'),
            cogneeClient.search(query, 'bank_transactions', 3, 'GRAPH_SUMMARY_COMPLETION'),
        ]);

        return { chunks, summary };
    }

    /**
     * Check if Cognee service is reachable.
     */
    async isHealthy(): Promise<boolean> {
        return cogneeClient.isHealthy();
    }
}

export const ragService = new RAGService();
