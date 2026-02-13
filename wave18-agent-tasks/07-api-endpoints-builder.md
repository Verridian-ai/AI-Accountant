# Agent 7: API Endpoints Builder

## Role
Wire 20 new API routes in server/src/index.ts for CDR crawling, product search, rate comparison, loan analysis, and rate alerts.

## Priority: WAVE 18 (After Agents 1-6)

## Wait Condition
Check for `.agent-done-W18-01`, `.agent-done-W18-02`, `.agent-done-W18-03`, `.agent-done-W18-05`, `.agent-done-W18-06` marker files before starting.

## Files to MODIFY

### 1. `server/src/index.ts`
**Current state**: ~4,300+ lines with existing routes
**Insert location**: After the last existing route block, before claude-agents mount

- [ ] Add imports after existing service imports:
  ```typescript
  import { CdrCrawler } from './services/cdr-crawler.js';
  import { CdrProductService } from './services/cdr-products.js';
  import { CdrCogneeIndexer } from './services/cdr-cognee-indexer.js';
  ```

- [ ] Instantiate services:
  ```typescript
  const cdrCrawler = new CdrCrawler();
  const cdrProductService = new CdrProductService();
  const cdrCogneeIndexer = new CdrCogneeIndexer();
  ```

- [ ] **CDR Crawl Routes (4 endpoints)**:

  ```typescript
  // Trigger full CDR crawl (discovery + catalog + details)
  app.post('/api/cdr/crawl/full', async (c) => {
    try {
      const result = await cdrCrawler.fullCrawl();
      return c.json(result);
    } catch (err) {
      console.error('CDR full crawl failed:', err);
      return c.json({ error: 'CDR crawl failed' }, 500);
    }
  });

  // Trigger incremental crawl (only updated products)
  app.post('/api/cdr/crawl/incremental', async (c) => {
    try {
      const { dataHolderIds } = await c.req.json();
      const result = await cdrCrawler.incrementalCrawl(dataHolderIds);
      return c.json(result);
    } catch (err) {
      console.error('CDR incremental crawl failed:', err);
      return c.json({ error: 'CDR incremental crawl failed' }, 500);
    }
  });

  // Crawl single data holder
  app.post('/api/cdr/crawl/data-holder/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const result = await cdrCrawler.crawlDataHolder(id);
      return c.json(result);
    } catch (err) {
      console.error('CDR data holder crawl failed:', err);
      return c.json({ error: 'Data holder crawl failed' }, 500);
    }
  });

  // Get crawl history/logs
  app.get('/api/cdr/crawl/logs', async (c) => {
    // Query cdr_crawl_log table, return recent crawl entries
  });
  ```

- [ ] **CDR Data Holder Routes (2 endpoints)**:
  ```typescript
  // List all data holders with summary
  app.get('/api/cdr/data-holders', async (c) => {
    const summary = await cdrProductService.getDataHolderSummary();
    return c.json(summary);
  });

  // Get data holder details
  app.get('/api/cdr/data-holders/:id', async (c) => {
    // Query cdr_data_holders by id with product counts
  });
  ```

- [ ] **CDR Product Routes (5 endpoints)**:
  ```typescript
  // Search products with filters
  app.get('/api/cdr/products', async (c) => {
    const filters = {
      productCategory: c.req.query('category'),
      rateType: c.req.query('rateType'),
      maxRate: c.req.query('maxRate') ? parseFloat(c.req.query('maxRate')!) : undefined,
      minRate: c.req.query('minRate') ? parseFloat(c.req.query('minRate')!) : undefined,
      features: c.req.query('features')?.split(','),
      loanPurpose: c.req.query('loanPurpose'),
      searchText: c.req.query('q'),
      sortBy: c.req.query('sortBy') as any,
      sortOrder: c.req.query('sortOrder') as any,
      limit: parseInt(c.req.query('limit') ?? '20'),
      offset: parseInt(c.req.query('offset') ?? '0')
    };
    const result = await cdrProductService.searchProducts(filters);
    return c.json(result);
  });

  // Get product categories summary
  app.get('/api/cdr/products/categories', async (c) => {
    const categories = await cdrProductService.getProductCategories();
    return c.json(categories);
  });

  // Get product detail
  app.get('/api/cdr/products/:id', async (c) => {
    // Fetch product with all child records (rates, fees, features, eligibility)
  });

  // Compare multiple products
  app.post('/api/cdr/products/compare', async (c) => {
    const { productIds } = await c.req.json();
    const comparison = await cdrProductService.compareProducts(productIds);
    return c.json(comparison);
  });

  // Get best rates by category
  app.get('/api/cdr/rates/best', async (c) => {
    const category = c.req.query('category') ?? 'RESIDENTIAL_MORTGAGES';
    const rateType = (c.req.query('type') ?? 'lending') as 'lending' | 'deposit';
    const limit = parseInt(c.req.query('limit') ?? '10');
    const rates = await cdrProductService.getBestRates(category, rateType, limit);
    return c.json(rates);
  });
  ```

- [ ] **Loan & Savings Routes (5 endpoints)**:
  ```typescript
  // Calculate savings vs CDR market
  app.post('/api/cdr/savings/calculate', async (c) => {
    const params = await c.req.json();
    const result = await cdrProductService.calculateSavings(params);
    return c.json(result);
  });

  // Get current market rates from CDR data
  app.get('/api/cdr/rates/market', async (c) => {
    const category = c.req.query('category') ?? 'RESIDENTIAL_MORTGAGES';
    const purpose = c.req.query('purpose');
    // Call loanCalculator.getMarketRates() - uses CDR data
    return c.json(rates);
  });

  // Refinance analysis
  app.post('/api/cdr/loans/refinance', async (c) => {
    const params = await c.req.json();
    // Call loanCalculator.refinanceAnalysis(params)
    return c.json(result);
  });

  // Borrowing capacity
  app.post('/api/cdr/loans/borrowing-capacity', async (c) => {
    const params = await c.req.json();
    // Call loanCalculator.borrowingCapacity(params)
    return c.json(result);
  });

  // Rate scenario modeling
  app.post('/api/cdr/loans/rate-scenarios', async (c) => {
    const params = await c.req.json();
    // Call loanCalculator.rateScenario(params)
    return c.json(result);
  });
  ```

- [ ] **Rate Alert Routes (3 endpoints)**:
  ```typescript
  // Create rate alert
  app.post('/api/cdr/alerts', async (c) => {
    const alert = await c.req.json();
    // Insert into cdr_rate_alerts table
    return c.json(created, 201);
  });

  // List user's rate alerts
  app.get('/api/cdr/alerts', async (c) => {
    const userId = c.req.query('userId') ?? 'default';
    // Query cdr_rate_alerts where user_id = userId
    return c.json(alerts);
  });

  // Delete rate alert
  app.delete('/api/cdr/alerts/:id', async (c) => {
    const id = c.req.param('id');
    // Soft delete (set is_active = false)
    return c.json({ success: true });
  });
  ```

- [ ] **Cognee Index Route (1 endpoint)**:
  ```typescript
  // Trigger CDR data indexing to Cognee
  app.post('/api/cdr/index', async (c) => {
    const { incremental, since } = await c.req.json().catch(() => ({}));
    const result = incremental
      ? await cdrCogneeIndexer.incrementalIndex(since)
      : await cdrCogneeIndexer.fullIndex();
    return c.json(result);
  });
  ```

### Route Summary (20 total):
| Method | Path | Handler |
|--------|------|---------|
| POST | /api/cdr/crawl/full | cdrCrawler.fullCrawl() |
| POST | /api/cdr/crawl/incremental | cdrCrawler.incrementalCrawl() |
| POST | /api/cdr/crawl/data-holder/:id | cdrCrawler.crawlDataHolder() |
| GET | /api/cdr/crawl/logs | query cdr_crawl_log |
| GET | /api/cdr/data-holders | cdrProductService.getDataHolderSummary() |
| GET | /api/cdr/data-holders/:id | query cdr_data_holders |
| GET | /api/cdr/products | cdrProductService.searchProducts() |
| GET | /api/cdr/products/categories | cdrProductService.getProductCategories() |
| GET | /api/cdr/products/:id | query product + children |
| POST | /api/cdr/products/compare | cdrProductService.compareProducts() |
| GET | /api/cdr/rates/best | cdrProductService.getBestRates() |
| POST | /api/cdr/savings/calculate | cdrProductService.calculateSavings() |
| GET | /api/cdr/rates/market | loanCalculator.getMarketRates() |
| POST | /api/cdr/loans/refinance | loanCalculator.refinanceAnalysis() |
| POST | /api/cdr/loans/borrowing-capacity | loanCalculator.borrowingCapacity() |
| POST | /api/cdr/loans/rate-scenarios | loanCalculator.rateScenario() |
| POST | /api/cdr/alerts | insert cdr_rate_alerts |
| GET | /api/cdr/alerts | query cdr_rate_alerts |
| DELETE | /api/cdr/alerts/:id | soft delete alert |
| POST | /api/cdr/index | cdrCogneeIndexer.fullIndex() |

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 20 routes accessible via curl (test after Docker rebuild)
- [ ] No route path conflicts with existing routes (all under `/api/cdr/`)
- [ ] GET /api/cdr/products returns paginated results
- [ ] POST /api/cdr/products/compare returns comparison matrix
- [ ] Create marker file: `.agent-done-W18-07`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W18-01`), Agent 2 (`.agent-done-W18-02`), Agent 3 (`.agent-done-W18-03`), Agent 5 (`.agent-done-W18-05`), Agent 6 (`.agent-done-W18-06`)
- **IMPORTANT**: Only this agent modifies server/src/index.ts for Wave 18 CDR routes
