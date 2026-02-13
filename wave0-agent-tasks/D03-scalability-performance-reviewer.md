# Agent D03: Scalability & Performance Reviewer

## Role

Review ALL wave plans for scalability bottlenecks, performance issues, and resource constraints. Ensure GoldLedger can handle growing data volumes and user counts.

## Phase: C (Debate — After W01 completes)

## Prerequisites

Wait for marker file: `.agent-done-W01`
Read ALL wave plans produced by W01.
Read R08's database schema research and R09's Docker infrastructure research.

## Review Tasks

### 1. Database Performance

- [ ] Assess query performance with projected table sizes:
  - transactions: Could grow to millions of rows per user
  - inventory_movements: High-volume for active businesses
  - market_data: Continuous ingestion from external APIs
- [ ] Check: Are indexes planned for common query patterns?
  - userId + date range queries (most common)
  - Category aggregation queries
  - Full-text search on descriptions
- [ ] Check: Are there N+1 query risks in the planned API endpoints?
- [ ] Assess: SQLite performance limits — at what data volume does it break?
- [ ] Assess: PostgreSQL pgvector performance for Cognee embeddings at scale

### 2. Cognee Performance

- [ ] Assess Kuzu graph store performance:
  - How many nodes/edges before 3D visualization (Wave 19) becomes slow?
  - Graph traversal query performance with 100K+ entities
  - Cognify processing time for large datasets
- [ ] Check: Is batch processing planned for large data ingestion?
- [ ] Check: Are there caching strategies for frequent Cognee queries?
- [ ] Assess: Redis caching (currently disconnected) — what's the impact of enabling it?

### 3. API Performance

- [ ] Check: Are there endpoints that could be slow?
  - Financial report generation (Wave 13) — complex aggregations
  - AR aging calculations (Wave 9) — scanning all invoices
  - CDR product comparison (Wave 20) — comparing across all data holders
  - Predictive analytics (Wave 15) — ML-like computations
- [ ] Check: Is pagination planned for all list endpoints?
- [ ] Check: Are there background job patterns for long-running operations?
- [ ] Assess: Should we add a job queue (Bull/BullMQ with Redis)?

### 4. Frontend Performance

- [ ] Assess: 3D graph visualization (Wave 19) — WebGL performance with large graphs
  - What's the max node count for smooth 60fps rendering?
  - Is level-of-detail (LOD) planned for large graphs?
  - Is lazy loading planned for graph data?
- [ ] Check: Are there large list views that need virtualization?
  - Transaction list (could be 10K+ items)
  - Invoice list, bill list, inventory items
- [ ] Check: Is code splitting planned for new feature modules?
- [ ] Assess: Bundle size impact of adding Three.js for 3D visualization

### 5. External API Rate Limits

- [ ] CDR APIs (Wave 20): Rate limits per data holder — is throttling planned?
- [ ] Market data APIs (Wave 21): Free tier limits — is caching sufficient?
- [ ] LLM API (Anthropic/OpenRouter): Token usage with 25+ agents — cost projection?
- [ ] Check: Are retry strategies with exponential backoff planned?

### 6. Concurrent User Scaling

- [ ] Assess: How many concurrent users can the current architecture handle?
- [ ] Check: Are there shared resources that become bottlenecks? (single Cognee instance, single PostgreSQL)
- [ ] Assess: Should we plan for horizontal scaling in later waves?
- [ ] Check: Is connection pooling configured for PostgreSQL?

### 7. Data Volume Projections

- [ ] Project data growth per user per year:
  - Transactions: ~2,000-5,000/year for small business
  - Invoices: ~500-2,000/year
  - Inventory movements: ~1,000-10,000/year
  - Market data: ~365 records/year per indicator
- [ ] At what user count does the system need architectural changes?

## Output Format

Write findings to `wave0-reviews/D03-scalability-review.md` with these sections:

1. **Critical Bottlenecks** — Issues that will cause problems at moderate scale
2. **Database Performance** — Index recommendations, query optimization
3. **Cognee Performance** — Graph size limits, caching strategy
4. **API Performance** — Slow endpoints, pagination, background jobs
5. **Frontend Performance** — 3D rendering, virtualization, code splitting
6. **External API Limits** — Rate limiting, caching, cost projections
7. **Scaling Roadmap** — When to add what (connection pooling, job queues, horizontal scaling)
8. **Recommendations by Wave** — Specific performance tasks to add to each wave

## Completion

- [ ] All sections populated with specific metrics and thresholds
- [ ] Create marker file: `.agent-done-D03`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Performance Modeling** | Estimate query times, API latency, rendering FPS at projected data volumes | Expert |
| **Bottleneck Identification** | Find N+1 queries, missing indexes, unoptimized aggregations | Expert |
| **Database Scaling Analysis** | Assess SQLite/PostgreSQL limits, connection pooling, pgvector performance | Expert |
| **Frontend Performance** | Evaluate 3D rendering (WebGL), list virtualization, code splitting, bundle size | Advanced |
| **External API Rate Planning** | Design throttling, caching, and retry strategies for external APIs | Advanced |
| **Capacity Planning** | Project data growth, estimate user count limits, plan horizontal scaling | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel performance review | Advanced |

## Sub-Agent Delegation Plan

```
D03 (Scalability & Performance Reviewer):
├── Sub-agent A: Database & Cognee Performance Review
│   ├── Review all waves for query performance concerns
│   ├── Assess index coverage for common query patterns
│   ├── Assess Cognee/Kuzu graph performance at scale
│   ├── Check pgvector embedding performance projections
│   └── Output: wave0-reviews/.scratch-D03-database.md
│
├── Sub-agent B: API & Backend Performance Review
│   ├── Identify slow endpoints (report generation, CDR comparison, predictions)
│   ├── Check pagination, background jobs, job queue needs
│   ├── Assess LLM API token usage and cost with 25+ agents
│   └── Output: wave0-reviews/.scratch-D03-api.md
│
├── Sub-agent C: Frontend & External API Performance Review
│   ├── Assess 3D graph visualization (Three.js) performance limits
│   ├── Check list virtualization needs (10K+ transactions)
│   ├── Review CDR/market data API rate limits and caching
│   └── Output: wave0-reviews/.scratch-D03-frontend.md
│
└── D03 Parent: Merge and produce scaling roadmap
    ├── Read all .scratch-D03-*.md files
    ├── Produce data volume projections per user per year
    ├── Identify critical bottlenecks with specific thresholds
    ├── Write final wave0-reviews/D03-scalability-review.md
    └── Delete scratch files
```

### Delegation Rules for D03

- Sub-agents write ONLY to `wave0-reviews/.scratch-D03-*.md` files
- Every bottleneck must include a specific threshold (e.g., "slow above 100K rows")
- Include concrete metrics, not vague concerns
- Propose specific solutions (add index X, use virtualization for Y)

## Dependencies

- **W01 must complete first**
- **Read-only** — does not modify W01's output files
