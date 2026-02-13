# Agent 3: Entity Service Builder

## Role
Build multi-entity management and financial consolidation services for group reporting.

## Priority: WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/multi-entity.ts`
**Purpose**: Create, manage, and link entities (companies, trusts, sole traders) with account relationships and hierarchy
**Pattern**: Pure service class, imports from `server/src/schema.ts`

- [ ] Create `MultiEntityService` class with the following methods:

**createEntity(params)**:
```typescript
createEntity(params: {
  userId: string;
  name: string;
  entityType: 'sole_trader' | 'company' | 'trust' | 'partnership' | 'smsf' | 'individual';
  abn?: string;
  acn?: string;
  tfn?: string;
  parentEntityId?: string;
  financialYearEnd?: string;   // default '06-30'
  address?: string;
  contactEmail?: string;
}): Promise<Entity>
```
- Generate UUID for id
- If parentEntityId provided, verify parent exists and belongs to same user
- Validate ABN format (11 digits) and ACN format (9 digits) if provided
- Insert into `entities` table
- Create default `entitySettings` record with sensible defaults based on entity type:
  - Company: gstRegistered=true, taxRate=0.25, basFrequency='quarterly'
  - Trust: gstRegistered=false, basFrequency='annually'
  - Sole trader: gstRegistered=false, basFrequency='quarterly'
- Return created entity

**updateEntity(entityId, updates)**:
- Partial update of mutable fields (name, abn, acn, status, address, contactEmail)
- Cannot change entityType after creation
- Update `updatedAt` timestamp

**linkAccount(params)**:
```typescript
linkAccount(params: {
  entityId: string;
  accountId: string;
  role: 'operating' | 'savings' | 'loan' | 'offset' | 'credit_card' | 'investment' | 'trust' | 'super';
  ownershipPercentage?: number;  // default 100
}): Promise<EntityAccount>
```
- Verify entity and account exist
- Verify account not already linked to this entity (UNIQUE constraint)
- Warn if account is already linked to a different entity (multi-entity scenario)
- Insert into `entityAccounts` table

**unlinkAccount(entityId, accountId)**:
- Delete from `entityAccounts` where entityId and accountId match
- Do not delete the account itself

**getEntityHierarchy(userId)**:
```typescript
getEntityHierarchy(userId: string): Promise<{
  entities: Array<Entity & {
    accounts: EntityAccount[];
    settings: EntitySetting | null;
    children: Entity[];
    parentName?: string;
  }>;
  rootEntities: Entity[];
  totalEntities: number;
}>
```
- Fetch all entities for user with their linked accounts and settings
- Build parent-child tree (entities with parentEntityId pointing to another entity)
- Identify root entities (no parent)
- Return flat list with children array for each entity

**getEntityWithAccounts(entityId)**:
```typescript
getEntityWithAccounts(entityId: string): Promise<{
  entity: Entity;
  settings: EntitySetting;
  accounts: Array<EntityAccount & { accountDetails: Account }>;
  parent?: Entity;
  children: Entity[];
}>
```
- Join entity with accounts table for full account details
- Include entity settings
- Include parent entity if exists
- Include child entities

**updateEntitySettings(entityId, settings)**:
```typescript
updateEntitySettings(entityId: string, settings: Partial<{
  basReportingFrequency: 'monthly' | 'quarterly' | 'annually';
  gstRegistered: boolean;
  gstMethod: 'cash' | 'accrual';
  taxRate: number;
  defaultDepreciationMethod: string;
  instantWriteOffThreshold: number;
  chartOfAccountsTemplate: string;
}>): Promise<EntitySetting>
```
- Upsert into `entitySettings`
- Validate tax rate between 0 and 1

**recordInterEntityTransaction(params)**:
```typescript
recordInterEntityTransaction(params: {
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  fromTransactionId?: string;
  toTransactionId?: string;
  amount: number;              // cents
  description: string;
  transactionDate: string;
  transactionType: 'loan' | 'management_fee' | 'dividend' | 'distribution' | 'rent' | 'service_fee' | 'asset_transfer' | 'capital_contribution';
  notes?: string;
}): Promise<InterEntityTransaction>
```
- Verify both entities exist and belong to same user
- Verify fromEntityId !== toEntityId
- Insert with status='pending'
- Return created record

**confirmInterEntityTransaction(transactionId, entityId, confirmed)**:
```typescript
confirmInterEntityTransaction(transactionId: string, entityId: string, confirmed: boolean): Promise<InterEntityTransaction>
```
- If entityId === fromEntityId, set confirmedByFrom
- If entityId === toEntityId, set confirmedByTo
- If both confirmed, update status to 'confirmed'
- If either rejects (confirmed=false), set status to 'disputed'

**getInterEntityTransactions(userId, filters?)**:
```typescript
getInterEntityTransactions(userId: string, filters?: {
  entityId?: string;          // filter where entity is from or to
  status?: string;
  financialYear?: string;
  transactionType?: string;
}): Promise<InterEntityTransaction[]>
```
- Query with filters, join entity names for display

### 2. `server/src/services/consolidation.ts`
**Purpose**: Financial consolidation engine for group reporting with elimination rules
**Pattern**: Pure service class, imports from schema and multi-entity service

- [ ] Create `ConsolidationService` class with the following methods:

**generateConsolidation(params)**:
```typescript
generateConsolidation(params: {
  userId: string;
  parentEntityId: string;
  financialYear: string;
}): Promise<{
  snapshot: ConsolidationSnapshot;
  lines: ConsolidationSnapshotLine[];
  eliminations: Array<{
    ruleId: string;
    ruleName: string;
    amount: number;
    description: string;
  }>;
}>
```
- Verify parentEntityId has `isConsolidatedParent=true`
- Fetch all child entities (recursive tree traversal)
- For each entity, aggregate transactions by category into revenue/expense/asset/liability/equity lines
- Apply elimination rules (see `applyEliminations`)
- Create `consolidationSnapshots` record with status='draft'
- Insert all `consolidationSnapshotLines`
- Return complete snapshot

**applyEliminations(parentEntityId, snapshotId, lines)**:
```typescript
applyEliminations(parentEntityId: string, snapshotId: string, lines: ConsolidationSnapshotLine[]): Promise<{
  eliminatedLines: ConsolidationSnapshotLine[];
  totalEliminationsAmount: number;
}>
```
- Fetch active `consolidationRules` for parent entity ordered by priority
- For each rule, evaluate criteria against lines:
  - **Inter-entity revenue/expense**: Match confirmed inter-entity transactions, create offsetting elimination entries
  - **Inter-entity loans**: Eliminate matching receivable/payable between entities
  - **Dividends/distributions**: Eliminate dividend income against equity reduction
  - **Management fees**: Eliminate fee income from parent against expense in child
- Insert elimination line items with `isElimination=true` and `sourceRuleId`
- Return list of eliminations applied

**createConsolidationRule(params)**:
```typescript
createConsolidationRule(params: {
  userId: string;
  parentEntityId: string;
  ruleName: string;
  ruleType: 'elimination' | 'adjustment' | 'reclassification' | 'minority_interest';
  description?: string;
  criteria: {
    matchType: 'inter_entity_revenue' | 'inter_entity_loan' | 'inter_entity_dividend' | 'category_match' | 'amount_threshold';
    matchEntities?: string[];     // entity IDs
    matchCategories?: string[];
    amountThreshold?: number;
  };
  action: {
    actionType: 'eliminate' | 'adjust' | 'reclassify';
    targetCategory?: string;
    adjustmentPercent?: number;
  };
  priority?: number;
}): Promise<ConsolidationRule>
```
- Serialize criteria and action as JSON
- Insert into `consolidationRules`

**updateConsolidationRule(ruleId, updates)**:
- Partial update, re-serialize JSON fields if changed

**deleteConsolidationRule(ruleId)**:
- Soft delete: set isActive=false

**createSnapshot(snapshotId, status)**:
```typescript
finalizeSnapshot(snapshotId: string): Promise<ConsolidationSnapshot>
```
- Set status to 'finalized'
- Prevent further modifications to the snapshot
- Record finalization timestamp

**getConsolidationHistory(parentEntityId, financialYear?)**:
```typescript
getConsolidationHistory(parentEntityId: string, financialYear?: string): Promise<{
  snapshots: Array<ConsolidationSnapshot & { lineCount: number }>;
}>
```
- Fetch snapshots with line count aggregation
- Filter by financial year if provided
- Order by creation date descending

**getSnapshotDetail(snapshotId)**:
```typescript
getSnapshotDetail(snapshotId: string): Promise<{
  snapshot: ConsolidationSnapshot;
  lines: ConsolidationSnapshotLine[];
  byEntity: Record<string, {
    entityName: string;
    revenue: number;
    expenses: number;
    assets: number;
    liabilities: number;
    equity: number;
  }>;
  eliminations: ConsolidationSnapshotLine[];
  consolidatedTotals: {
    revenue: number;
    expenses: number;
    netProfit: number;
    assets: number;
    liabilities: number;
    equity: number;
  };
}>
```
- Fetch snapshot with all lines
- Group by entity for entity-level breakdown
- Separate elimination lines
- Calculate consolidated totals (entity totals minus eliminations)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] MultiEntityService.createEntity() returns valid entity with settings
- [ ] Entity hierarchy correctly nests child entities under parents
- [ ] Inter-entity transaction confirmation works bidirectionally
- [ ] Consolidation correctly eliminates matching inter-entity revenue/expense
- [ ] Test: Entity A invoices Entity B $10,000 management fee → consolidation eliminates $10,000 from both revenue and expense
- [ ] Create marker file: `.agent-done-W12-03`

## Dependencies
- **None** — can start immediately (uses schema types via import, does not modify schema)
- **Schema lock**: Does NOT modify schema.ts — reads only. Agent 1 owns schema modifications.
- **Reuses**: schema.ts types (Entity, EntityAccount, EntitySetting, InterEntityTransaction, ConsolidationRule, ConsolidationSnapshot, ConsolidationSnapshotLine), Drizzle db instance
