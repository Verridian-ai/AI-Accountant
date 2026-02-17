/**
 * Cognee Client — Main Class
 *
 * Unified client for all Cognee operations with per-user auth (Wave 3)
 * and multi-tenant isolation (Wave 23).
 *
 * Extends CogneeClientBase and delegates to operation modules:
 * - auth.ts: authentication & headers
 * - data-ops.ts: add, addWithNodeSets, domain methods
 * - cognify.ts: cognify, addAndCognify, temporalCognify
 * - search.ts: search, searchRich, crossDatasetSearch, temporalSearch, searchWithSession
 * - datasets.ts: listDatasets, createDataset, deleteDataset, getDatasetStatus, getDatasetGraph
 * - merchant-memory.ts: storeMerchantMapping, lookupMerchant, updateMerchantFromCorrection
 */

import { CogneeClientBase } from './client-base.js';
import { addData, addDataWithNodeSets } from './data-ops.js';
import { cognify, addAndCognify, temporalCognify, cognifyWithOntology } from './cognify.js';
import {
  search,
  searchRich,
  crossDatasetSearch,
  temporalSearch,
  searchWithSession,
  searchAcrossTenants,
  searchWithNodeSets,
} from './search.js';
import {
  listDatasets,
  createDataset,
  deleteDataset,
  getDatasetStatus,
  getDatasetGraph,
} from './datasets.js';
import {
  storeMerchantMapping,
  lookupMerchant,
  updateMerchantFromCorrection,
  batchLookupMerchants,
} from './merchant-memory.js';
import type { CogneeSearchType, CogneeSearchResult } from './types.js';

export class CogneeClient extends CogneeClientBase {
  // --------------------------------------------------------------------------
  // Data Operations
  // --------------------------------------------------------------------------

  async addData(data: string[], dataset: string, userId?: string, tenantId?: string) {
    return addData(this.state, data, dataset, userId, tenantId);
  }

  async addDataWithNodeSets(
    data: string[],
    dataset: string,
    nodeSets: string[],
    userId?: string,
    tenantId?: string,
  ) {
    return addDataWithNodeSets(this.state, data, dataset, nodeSets, userId, tenantId);
  }

  // --------------------------------------------------------------------------
  // Cognify Operations
  // --------------------------------------------------------------------------

  async cognify(
    datasets?: string[],
    background: boolean = true,
    customPrompt?: string,
    userId?: string,
    tenantId?: string,
  ) {
    return cognify(this.state, datasets, background, customPrompt, userId, tenantId);
  }

  async addAndCognify(
    data: string[],
    dataset: string,
    background: boolean = true,
    userId?: string,
    tenantId?: string,
  ) {
    return addAndCognify(this.state, data, dataset, background, userId, tenantId);
  }

  async temporalCognify(
    dataset: string,
    options?: { customPrompt?: string; background?: boolean },
    userId?: string,
    tenantId?: string,
  ) {
    return temporalCognify(this.state, dataset, options, userId, tenantId);
  }

  async cognifyWithOntology(
    datasets: string[],
    ontologyPath?: string,
    background: boolean = true,
    customPrompt?: string,
    userId?: string,
    tenantId?: string,
  ) {
    return cognifyWithOntology(
      this.state,
      datasets,
      ontologyPath,
      background,
      customPrompt,
      userId,
      tenantId,
    );
  }

  // --------------------------------------------------------------------------
  // Search Operations
  // --------------------------------------------------------------------------

  async search(
    query: string,
    dataset: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    userId?: string,
    tenantId?: string,
  ): Promise<string[]> {
    return search(this.state, query, dataset, topK, searchType, userId, tenantId);
  }

  async searchRich(
    query: string,
    dataset: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    return searchRich(this.state, query, dataset, topK, searchType, userId, tenantId);
  }

  async crossDatasetSearch(
    query: string,
    datasets: string[],
    options?: { searchType?: CogneeSearchType; topK?: number; mergeResults?: boolean },
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    return crossDatasetSearch(this.state, query, datasets, options, userId, tenantId);
  }

  async temporalSearch(
    query: string,
    options: {
      dataset: string;
      timeStart?: string;
      timeEnd?: string;
      searchType?: CogneeSearchType;
      topK?: number;
    },
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    return temporalSearch(this.state, query, options, userId, tenantId);
  }

  async searchWithSession(
    query: string,
    dataset: string,
    sessionId: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'CHUNKS',
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    return searchWithSession(this.state, query, dataset, sessionId, topK, searchType, userId, tenantId);
  }

  async searchAcrossTenants(
    query: string,
    datasets: string[],
    tenantIds: string[],
    options?: { searchType?: CogneeSearchType; topK?: number },
    userId?: string,
  ): Promise<CogneeSearchResult[]> {
    return searchAcrossTenants(this.state, query, datasets, tenantIds, options, userId);
  }

  async searchWithNodeSets(
    query: string,
    dataset: string,
    nodeSets: string[],
    topK: number = 5,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    return searchWithNodeSets(this.state, query, dataset, nodeSets, topK, searchType, userId, tenantId);
  }

  // --------------------------------------------------------------------------
  // Dataset Operations
  // --------------------------------------------------------------------------

  async listDatasets(userId?: string, tenantId?: string) {
    return listDatasets(this.state, userId, tenantId);
  }

  async createDataset(name: string, userId?: string, tenantId?: string) {
    return createDataset(this.state, name, userId, tenantId);
  }

  async deleteDataset(name: string, userId?: string, tenantId?: string) {
    return deleteDataset(this.state, name, userId, tenantId);
  }

  async getDatasetStatus(name: string, userId?: string, tenantId?: string) {
    return getDatasetStatus(this.state, name, userId, tenantId);
  }

  async getDatasetGraph(name: string, userId?: string, tenantId?: string) {
    return getDatasetGraph(this.state, name, userId, tenantId);
  }

  // --------------------------------------------------------------------------
  // Merchant Memory
  // --------------------------------------------------------------------------

  async storeMerchantMapping(
    merchant: string,
    category: string,
    userId?: string,
    tenantId?: string,
  ) {
    return storeMerchantMapping(this.state, merchant, category, userId, tenantId);
  }

  async lookupMerchant(rawDescription: string, userId?: string, tenantId?: string) {
    return lookupMerchant(this.state, rawDescription, userId, tenantId);
  }

  async updateMerchantFromCorrection(
    rawDescription: string,
    oldCategory: string,
    newCategory: string,
    userId?: string,
    tenantId?: string,
  ) {
    return updateMerchantFromCorrection(
      this.state,
      rawDescription,
      oldCategory,
      newCategory,
      userId,
      tenantId,
    );
  }

  async batchLookupMerchants(descriptions: string[], userId?: string, tenantId?: string) {
    return batchLookupMerchants(this.state, descriptions, userId, tenantId);
  }
}
