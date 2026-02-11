import { logger } from '../utils/logger.js';

const COGNEE_API_URL = process.env.COGNEE_API_URL || 'http://localhost:8000';
const USE_COGNEE = process.env.USE_COGNEE === 'true';

export class RAGService {
    /**
     * Generic JSON request to Cognee API
     */
    private async cogneeJsonRequest(method: string, path: string, body?: unknown): Promise<any> {
        if (!USE_COGNEE) {
            logger.debug('[RAG] Cognee disabled (USE_COGNEE=false), skipping');
            return null;
        }

        const url = `${COGNEE_API_URL}${path}`;
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!res.ok) {
                const text = await res.text();
                logger.warn(`[RAG] Cognee ${method} ${path} returned ${res.status}: ${text}`);
                return null;
            }

            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                return await res.json();
            }
            return await res.text();
        } catch (err) {
            logger.error(`[RAG] Cognee request failed: ${method} ${path}`, err);
            return null;
        }
    }

    /**
     * Add data to Cognee via multipart form upload.
     * Cognee /api/v1/add expects:
     *   - data: List[UploadFile] (files)
     *   - datasetName: Form field (string)
     */
    private async cogneeAddData(textContent: string, datasetName: string): Promise<any> {
        if (!USE_COGNEE) return null;

        const url = `${COGNEE_API_URL}/api/v1/add`;
        try {
            // Create a Blob to upload as a file
            const blob = new Blob([textContent], { type: 'text/plain' });
            const formData = new FormData();
            formData.append('data', blob, `${datasetName}.txt`);
            formData.append('datasetName', datasetName);

            const res = await fetch(url, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const text = await res.text();
                logger.warn(`[RAG] Cognee add returned ${res.status}: ${text}`);
                return null;
            }

            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                return await res.json();
            }
            return await res.text();
        } catch (err) {
            logger.error(`[RAG] Cognee add failed`, err);
            return null;
        }
    }

    /**
     * Index transactions into Cognee knowledge graph.
     * Converts transactions to text, uploads as a file, then triggers cognify.
     */
    async indexTransactions(transactions: unknown[]) {
        if (!USE_COGNEE) return null;

        const lines = (transactions as any[]).map(tx =>
            `Date: ${tx.date}, Description: ${tx.description}, Amount: $${(tx.amount / 100).toFixed(2)}, Category: ${tx.category}, Notes: ${tx.aiReasoningNotes || 'N/A'}`
        );
        const textContent = lines.join('\n');

        logger.info(`[RAG] Indexing ${lines.length} transactions in Cognee...`);

        const result = await this.cogneeAddData(textContent, 'bank_transactions');

        if (result) {
            // Trigger cognify to build knowledge graph from the data
            logger.info('[RAG] Triggering cognify to process data...');
            await this.cogneeJsonRequest('POST', '/api/v1/cognify', {
                datasets: ['bank_transactions'],
            });
            logger.info('[RAG] Cognee indexing triggered successfully');
        }

        return result;
    }

    /**
     * Add documents to Cognee knowledge base.
     */
    async addDocuments(documents: string[], datasetName: string = 'knowledge_base') {
        const textContent = documents.join('\n\n---\n\n');
        return this.cogneeAddData(textContent, datasetName);
    }

    /**
     * Search Cognee knowledge graph.
     * Uses GRAPH_COMPLETION search type for context-aware answers.
     */
    async search(query: string, _model?: string) {
        if (!USE_COGNEE) return { results: [] };

        logger.info(`[RAG] Searching Cognee: "${query}"`);
        const result = await this.cogneeJsonRequest('POST', '/api/v1/search', {
            query: query,
            search_type: 'GRAPH_COMPLETION',
            datasets: ['bank_transactions'],
            top_k: 10,
        });

        // Cognee returns array of SearchResult directly
        if (Array.isArray(result)) {
            return { results: result };
        }
        return result || { results: [] };
    }

    /**
     * Check if Cognee service is reachable.
     */
    async isHealthy(): Promise<boolean> {
        try {
            const res = await fetch(`${COGNEE_API_URL}/api/v1/settings`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            return res.ok;
        } catch {
            return false;
        }
    }
}

export const ragService = new RAGService();
