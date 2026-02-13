# Agent 03: Type Compatibility & Remaining Errors

## Mission
Fix ALL remaining TypeScript errors after Agents 01 and 02 have run. This includes TS2322, TS2345, TS2769, TS2352, TS2304, TS2307, TS2724, and any leftover errors.

## CRITICAL RULES
1. Do NOT change business logic — only fix type issues
2. Prefer type assertions (`as unknown as X`) over rewriting logic
3. For missing npm modules, add `// @ts-ignore` or create declaration files
4. Run `npx tsc -b --noEmit 2>&1 | grep "error TS" | wc -l` to track progress

## Error Categories to Fix

### TS2322 — Type not assignable (8 errors)
- `TreeMap.tsx(88)` — props not assignable to IntrinsicAttributes → use `as any`
- `CogneeGraph2DFallback.tsx(86,90)` — `string | undefined` not assignable to `string` → add `?? ''`
- `MatchReviewPanel.tsx(59)` — `string | undefined` → add `?? ''`
- `SchemaExplorer.tsx(121)` — `unknown` not assignable to `ReactNode` → cast `as ReactNode`
- `AuditTrailViewer.tsx(277)` — `{}` not assignable to `ReactNode` → cast or fix
- `routes.tsx(170)` — LazyExoticComponent type mismatch → wrap component or cast
- `InventoryValuation.tsx(554)` — props not assignable to IntrinsicAttributes

### TS2345 — Argument type not assignable (6 errors)
- `PurchaseOrderEditor.tsx(176,179)` — object not assignable to `Partial<PurchaseOrder>` → add missing fields or cast
- `ScenarioComparer.tsx(71)` — SetStateAction type mismatch → ensure all required fields present
- `SentimentDashboard.tsx(71)` — undefined in union → filter or default
- `CompanyReturn/PersonalReturn/SoleTraderReturn/TrustReturn` — `unknown` to `number` → cast

### TS2769 — No overload matches (3 errors)
- `Sankey.tsx(108)` — Recharts Sankey component type issue → cast node/link props as `any`
- `InventoryValuation.tsx(428)` — Recharts overload → cast props
- `MoneyFlowSankey.tsx(303)` — Recharts overload → cast props

### TS2352 — Type conversion mistake (2 errors)
- `Sankey.tsx(53)` — cast through `unknown` first: `as unknown as TargetType`
- `Sankey.tsx(77)` — same pattern

### TS2304 — Cannot find name (2 errors)
- `BottomNavigation.tsx(20)` — `Activity` not found → import from lucide-react
- `AdminDashboard.tsx(173)` — `Flag` not found → import from lucide-react

### TS2307 — Cannot find module (2 errors)
- `CogneeGraphViewer.tsx(2)` — `3d-force-graph` module not found → create `src/types/3d-force-graph.d.ts`
- `CogneeGraphViewer.tsx(3)` — `three-forcegraph` module not found → create `src/types/three-forcegraph.d.ts`

### TS2724 — Did you mean? (2 errors)
- `RateTracker.tsx` — `fetchMarketRates` → rename to `fetchMarketPrices` (or add alias in api.ts)

### Other Errors
- `PushPermissionPrompt.tsx(41)` — Uint8Array/BufferSource issue → cast with `as any`
- `ForecastDashboard.tsx(73)` — `style` possibly undefined → add optional chaining
- `IntelligenceTimeline.tsx(180)` — object possibly undefined → add optional chaining
- `KnowledgeGraphExplorer.tsx(249,253)` — `string | undefined` → add `?? ''`
- `DataPointManager.tsx(247)` — `title` prop doesn't exist → remove or use correct prop name

## Strategy
1. Wait for Agents 01 and 02 marker files (`.agent-done-GF-01` and `.agent-done-GF-02`)
2. Run `npx tsc -b --noEmit 2>&1 | grep "error TS"` to get current error list
3. Fix errors file by file, starting with the simplest fixes
4. For module declarations, create `client/src/types/` directory with `.d.ts` files
5. Re-run tsc after each batch of fixes

## Module Declaration Files to Create

### client/src/types/3d-force-graph.d.ts
```typescript
declare module '3d-force-graph' {
  const ForceGraph3D: any;
  export default ForceGraph3D;
}
```

### client/src/types/three-forcegraph.d.ts
```typescript
declare module 'three-forcegraph' {
  const ThreeForceGraph: any;
  export default ThreeForceGraph;
}
```

## Completion
When done, create marker file: `touch .agent-done-GF-03`

