import { Hono } from 'hono';
import { db, transactions, accounts, statements } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { agentService, type PythonAgentType } from '../services/agents.js';

const agentsExtRoutes = new Hono();

// GET /api/agents/:type — Get specific agent info
agentsExtRoutes.get('/agents/:type', async (c) => {
  try {
    const agentType = c.req.param('type') as PythonAgentType;
    const info = await agentService.getAgentInfo(agentType);
    return c.json(info);
  } catch (err) {
    console.error('Failed to get agent info:', err);
    return c.json({ error: 'Failed to get agent info' }, 500);
  }
});

// POST /api/agents/:type/run — Run an agent with a query
agentsExtRoutes.post('/agents/:type/run', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const agentType = c.req.param('type') as PythonAgentType;
    const body = await c.req.json();
    const { query } = body;

    if (!query) return c.json({ error: 'Query is required' }, 400);

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
    const userStatements = await db.select().from(statements).where(eq(statements.userId, userId));

    const result = await agentService.runAgent(agentType, query, {
      transactions: userTransactions,
      accounts: userAccounts,
      statements: userStatements,
    });

    return c.json(result);
  } catch (err) {
    console.error('Agent execution failed:', err);
    return c.json({ error: 'Agent execution failed', details: String(err) }, 500);
  }
});

// POST /api/agents/code/execute — Execute Python code in sandbox
agentsExtRoutes.post('/agents/code/execute', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const { code, context } = body;

    if (!code) return c.json({ error: 'Code is required' }, 400);

    const codeContext = context || {};
    if (body.includeTransactions) {
      const userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId));
      codeContext.transactions = userTransactions;
    }

    const result = await agentService.executeCode(code, codeContext);
    return c.json(result);
  } catch (err) {
    console.error('Code execution failed:', err);
    return c.json({ error: 'Code execution failed', details: String(err) }, 500);
  }
});

// POST /api/agents/analyze-finances — Financial analysis endpoint
agentsExtRoutes.post('/agents/analyze-finances', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const { query } = body;

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));

    const result = await agentService.analyzeFinances(
      query || 'Analyze my spending patterns and provide insights',
      { transactions: userTransactions, accounts: userAccounts },
    );

    return c.json(result);
  } catch (err) {
    console.error('Financial analysis failed:', err);
    return c.json({ error: 'Financial analysis failed' }, 500);
  }
});

// POST /api/agents/calculate-bas — BAS calculation endpoint
agentsExtRoutes.post('/agents/calculate-bas', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const { query, quarter } = body;

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    const result = await agentService.calculateBAS(
      query || `Calculate BAS for ${quarter || 'the current period'}`,
      { transactions: userTransactions },
    );

    return c.json(result);
  } catch (err) {
    console.error('BAS calculation failed:', err);
    return c.json({ error: 'BAS calculation failed' }, 500);
  }
});

// POST /api/agents/calculate-tax — Tax calculation endpoint
agentsExtRoutes.post('/agents/calculate-tax', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const { query, grossIncome, taxWithheld } = body;

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    const result = await agentService.calculateTax(
      query ||
        `Calculate my tax liability. Gross income: $${grossIncome || 'unknown'}, Tax withheld: $${taxWithheld || 'unknown'}`,
      { transactions: userTransactions },
    );

    return c.json(result);
  } catch (err) {
    console.error('Tax calculation failed:', err);
    return c.json({ error: 'Tax calculation failed' }, 500);
  }
});

// POST /api/agents/reconcile — Reconciliation endpoint
agentsExtRoutes.post('/agents/reconcile', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const { query } = body;

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    const userStatements = await db.select().from(statements).where(eq(statements.userId, userId));

    const result = await agentService.reconcileTransactions(
      query || 'Find duplicate transactions and verify statement balances',
      { transactions: userTransactions, statements: userStatements },
    );

    return c.json(result);
  } catch (err) {
    console.error('Reconciliation failed:', err);
    return c.json({ error: 'Reconciliation failed' }, 500);
  }
});

export default agentsExtRoutes;
