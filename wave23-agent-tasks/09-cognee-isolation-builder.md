# Agent 9: Cognee Isolation Builder

## Role
Modify the Cognee integration to be tenant-aware by prefixing all dataset names with tenant IDs for data isolation. Admin users can optionally query across tenants.

## Priority: WAVE 23 (After Agents 2, 6)

## Wait Condition
Check for `.agent-done-W23-02` and `.agent-done-W23-06` marker files before starting.

## Files to MODIFY

### 1. `server/src/services/cognee_client.ts`
**Current state**: Single `CogneeClient` class with methods: `add()`, `search()`, `cognify()`, `listDatasets()`, `getDatasetStatus()`, `getDatasetGraph()`, `createDataset()`
**Reference**: Uses multipart FormData for add, JSON for search, datasets array for cognify

- [ ] Add tenant prefix to ALL dataset operations:
  ```typescript
  private getTenantDatasetName(tenantId: string, datasetName: string): string {
    return `tenant_${tenantId}_${datasetName}`;
  }
  ```

- [ ] Modify `add(data, datasetName, tenantId)`:
  - Add `tenantId` parameter (required)
  - Prefix dataset name: `tenant_${tenantId}_${datasetName}`
  - Validate tenantId is non-empty before proceeding

- [ ] Modify `search(query, options, tenantId)`:
  - Add `tenantId` parameter (required)
  - Prefix all dataset names in `options.datasets` with tenant prefix
  - Ensure search results only return data from tenant's datasets

- [ ] Modify `cognify(datasets, options, tenantId)`:
  - Add `tenantId` parameter (required)
  - Prefix all dataset names with tenant prefix

- [ ] Modify `listDatasets(tenantId?)`:
  - If `tenantId` provided: filter to only datasets matching `tenant_${tenantId}_*` prefix
  - If no tenantId (admin): return all datasets

- [ ] Modify `getDatasetStatus(datasetName, tenantId)`:
  - Prefix dataset name with tenant prefix

- [ ] Modify `createDataset(datasetName, tenantId)`:
  - Prefix dataset name with tenant prefix
  - Store mapping in memory for reverse lookup

- [ ] Add cross-tenant search for admin:
  ```typescript
  async searchAcrossTenants(query: string, options: SearchOptions, tenantIds: string[]): Promise<SearchResult[]> {
    // Only callable by users with admin role across all specified tenants
    const allDatasets = tenantIds.flatMap(tid =>
      (options.datasets || []).map(ds => this.getTenantDatasetName(tid, ds))
    );
    return this.search(query, { ...options, datasets: allDatasets });
  }
  ```

### 2. `server/src/services/claude/cognee-tools.ts`
**Current state**: Agent tools for Cognee search with batching

- [ ] Modify all tool handlers to accept and pass `tenantId`:
  - `searchCognee(query, searchType, datasets, tenantId)` -- passes tenantId to CogneeClient.search()
  - `indexToCognee(data, datasetName, tenantId)` -- passes tenantId to CogneeClient.add()
- [ ] Update tool schemas to include `tenantId` as required parameter
- [ ] When called from agent context: extract tenantId from agent's input context

### 3. `server/src/services/pipeline.ts`
**Current state**: Processing pipeline for statements and transactions

- [ ] Pass `tenantId` through the pipeline:
  - Extract from request context at pipeline entry
  - Thread through all Cognee operations (indexing, search)
  - Ensure uploaded statement data is indexed to tenant-specific datasets

### 4. `server/src/services/claude/orchestrator.ts`
- [ ] Pass `tenantId` to all agent executions
- [ ] Ensure agent tool calls include tenantId in their parameters
- [ ] Add tenantId validation: reject if tenantId is missing or empty

### 5. `server/src/index.ts` (Cognee-related routes only)
- [ ] Modify `/api/chat` endpoint to extract `tenantId` from context and pass to Cognee search
- [ ] Modify any Cognee admin endpoints to support cross-tenant querying with admin role check

## Files to CREATE

### 6. `server/src/services/cognee-migration.ts`
**Purpose**: One-time migration utility to prefix existing datasets with a default tenant ID

- [ ] Export `migrateLegacyDatasets(defaultTenantId: string): Promise<MigrationResult>`:
  - List all existing datasets without tenant prefix
  - For each: create new dataset with prefix, copy data, mark old as deprecated
  - Return: `{ migrated: number, skipped: number, errors: string[] }`
- [ ] This is a utility -- run manually during multi-tenant migration, not automatically

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All Cognee operations prefix dataset names with `tenant_${tenantId}_`
- [ ] Tenant A's search does not return results from Tenant B's datasets
- [ ] Admin cross-tenant search returns results from all specified tenants
- [ ] Pipeline correctly threads tenantId through all Cognee operations
- [ ] Chat endpoint uses tenant-scoped Cognee search
- [ ] Legacy migration utility works on existing datasets
- [ ] Create marker file: `.agent-done-W23-09`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W23-02`) for TenantService, Agent 6 (`.agent-done-W23-06`) for auth context
- **Reuses**: Existing CogneeClient, cognee-tools.ts, pipeline.ts, orchestrator.ts
- **IMPORTANT**: This agent has exclusive rights to modify cognee_client.ts and cognee-tools.ts in Wave 23
