/**
 * RAG Service — Cognee-backed knowledge graph for transactions.
 *
 * Delegates all HTTP calls to cogneeClient (the single source of truth).
 * Adds USE_COGNEE gate, transaction formatting, and cognify triggers.
 *
 * Wave 3: Optional userId parameter on all methods for per-user dataset isolation.
 * When userId is provided, datasets are scoped via CogneeTools.forUser().
 * Without userId, existing admin-token behavior is preserved (backward compatible).
 */

import { logger } from '../utils/logger.js';
import { cogneeClient } from './cognee_client.js';
import { CogneeTools } from './claude/cognee-tools.js';
import type { CogneeSearchType } from './cognee_client.js';

const USE_COGNEE = process.env.USE_COGNEE === 'true';

export class RAGService {
    /**
     * Index transactions into Cognee knowledge graph.
     * Converts transactions to text, uploads via cogneeClient, then triggers cognify
     * with the bank_transactions dataset name (not empty body).
     *
     * @param transactions - Array of transaction objects to index
     * @param userId - Optional user ID for per-user dataset isolation (Wave 3)
     */
    async indexTransactions(transactions: unknown[], userId?: string) {
        if (!USE_COGNEE) return null;

        const lines = (transactions as any[]).map(tx =>
            `Date: ${tx.date}, Description: ${tx.description}, Amount: $${(tx.amount / 100).toFixed(2)}, Category: ${tx.category}, Notes: ${tx.aiReasoningNotes || 'N/A'}`
        );

        logger.info(`[RAG] Indexing ${lines.length} transactions in Cognee...`);

        try {
            if (userId) {
                // Wave 3: Use per-user scoped tools
                const tools = CogneeTools.forUser(userId);
                await tools.indexAndCognify(lines, 'bank_transactions');
            } else {
                await cogneeClient.add(lines, 'bank_transactions');
                logger.info('[RAG] Triggering cognify for bank_transactions dataset...');
                await cogneeClient.cognify(['bank_transactions'], true);
            }
            logger.info('[RAG] Cognee cognify triggered in background');
            return { status: 'ok' };
        } catch (err) {
            logger.error('[RAG] Cognee indexing failed', err);
            return null;
        }
    }

    /**
     * Add documents to Cognee knowledge base.
     *
     * @param documents - Array of document strings to add
     * @param datasetName - Target dataset name (default: 'knowledge_base')
     * @param userId - Optional user ID for per-user dataset isolation (Wave 3)
     */
    async addDocuments(documents: string[], datasetName: string = 'knowledge_base', userId?: string) {
        if (!USE_COGNEE) return null;
        if (userId) {
            const tools = CogneeTools.forUser(userId);
            await tools.index(documents, datasetName);
            return { status: 'ok' };
        }
        return cogneeClient.add(documents, datasetName);
    }

    /**
     * Search Cognee knowledge graph with configurable search type.
     * Defaults to GRAPH_COMPLETION for context-aware answers.
     *
     * @param query - Search query string
     * @param _model - Unused model parameter (kept for backward compat)
     * @param searchType - Cognee search type
     * @param userId - Optional user ID for per-user dataset isolation (Wave 3)
     */
    async search(
        query: string,
        _model?: string,
        searchType: CogneeSearchType = 'GRAPH_COMPLETION',
        userId?: string
    ) {
        if (!USE_COGNEE) return { results: [] };

        logger.info(`[RAG] Searching Cognee (${searchType}): "${query}"`);

        if (userId) {
            const tools = CogneeTools.forUser(userId);
            const results = await tools.search(query, 'bank_transactions', searchType);
            return { results };
        }

        const results = await cogneeClient.search(query, 'bank_transactions', 10, searchType);
        return { results };
    }

    /**
     * Multi-type search: combines CHUNKS (direct matches) + GRAPH_SUMMARY_COMPLETION
     * (contextual analysis) for richer chat context.
     *
     * @param query - Search query string
     * @param userId - Optional user ID for per-user dataset isolation (Wave 3)
     */
    async searchMulti(query: string, userId?: string): Promise<{ chunks: string[]; summary: string[] }> {
        if (!USE_COGNEE) return { chunks: [], summary: [] };

        logger.info(`[RAG] Multi-search Cognee: "${query}"`);

        if (userId) {
            const tools = CogneeTools.forUser(userId);
            const [chunks, summary] = await Promise.all([
                tools.search(query, 'bank_transactions', 'CHUNKS'),
                tools.search(query, 'bank_transactions', 'GRAPH_SUMMARY_COMPLETION'),
            ]);
            return { chunks, summary };
        }

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
