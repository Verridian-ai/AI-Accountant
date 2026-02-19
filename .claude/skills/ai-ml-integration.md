# AI/ML Integration Patterns

## Overview
Patterns for integrating LLM APIs (Claude, OpenRouter), streaming responses, tool use, agent orchestration, and embeddings in the GoldLedger stack (Hono + TypeScript). Covers the Anthropic SDK, Cognee knowledge graph, and circuit breaker fallback.

## Key Patterns

### Pattern 1: Claude Agent with Tool Use
All GoldLedger agents follow the same structure: define tools, call `client.messages.create`, handle tool results in a loop.

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: 'get_transactions',
    description: 'Fetch transactions for a date range',
    input_schema: {
      type: 'object' as const,
      properties: {
        startDate: { type: 'string', description: 'ISO date' },
        endDate: { type: 'string', description: 'ISO date' },
      },
      required: ['startDate', 'endDate'],
    },
  },
];

async function runAgent(userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6-20250929',
      max_tokens: 4096,
      tools,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : '';
    }

    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        if (toolUse.type !== 'tool_use') continue;
        const result = await dispatchTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }
  }
}
```

### Pattern 2: Streaming Responses via Hono SSE
GoldLedger streams Claude responses to the client via Server-Sent Events.

```typescript
import { streamSSE } from 'hono/streaming';

app.post('/api/chat', async (c) => {
  return streamSSE(c, async (stream) => {
    const anthropic = new Anthropic();
    const messageStream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6-20250929',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const event of messageStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        await stream.writeSSE({ data: event.delta.text, event: 'text' });
      }
    }
    await stream.writeSSE({ data: '[DONE]', event: 'done' });
  });
});
```

### Pattern 3: Circuit Breaker + OpenRouter Fallback
GoldLedger uses 5 failures = trip, 60s recovery, then falls back to OpenRouter.

```typescript
interface CircuitBreaker {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const breaker: CircuitBreaker = { failures: 0, lastFailure: 0, state: 'closed' };

async function callWithFallback(prompt: string): Promise<string> {
  const now = Date.now();
  if (breaker.state === 'open' && now - breaker.lastFailure > 60_000) {
    breaker.state = 'half-open';
  }

  if (breaker.state !== 'open') {
    try {
      const result = await callClaude(prompt);
      breaker.failures = 0;
      breaker.state = 'closed';
      return result;
    } catch {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      if (breaker.failures >= 5) breaker.state = 'open';
    }
  }

  // Fallback to OpenRouter
  return callOpenRouter(prompt);
}

async function callOpenRouter(prompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content ?? '';
}
```

### Pattern 4: Structured Output with Zod Validation
Parse LLM responses safely with Zod schemas.

```typescript
import { z } from 'zod';

const TransactionSchema = z.object({
  merchant: z.string(),
  amount: z.number().int(), // cents
  category: z.enum(['food', 'transport', 'utilities', 'other']),
  gstAmount: z.number().int().optional(),
});

async function extractTransaction(rawText: string): Promise<z.infer<typeof TransactionSchema>> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-6-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Extract transaction data as JSON:\n${rawText}\nRespond with only valid JSON.`,
    }],
  });

  const text = response.content.find(b => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No text response');

  const parsed = JSON.parse(text.text) as unknown;
  return TransactionSchema.parse(parsed); // throws if invalid
}
```

### Pattern 5: Embeddings for Cognee Semantic Search
GoldLedger uses `text-embedding-3-small` (1536 dims) via OpenRouter for Cognee indexing.

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: text,
    }),
  });
  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0]?.embedding ?? [];
}
```

### Pattern 6: Model Selection by Task Complexity
Match model to task complexity to optimize cost vs quality.

```typescript
type AgentTask = 'categorize' | 'parse' | 'analyze' | 'strategy';

const MODEL_MAP: Record<AgentTask, string> = {
  categorize: 'claude-haiku-4-6-20251001',   // Fast, cheap — simple classification
  parse: 'claude-sonnet-4-6-20250929',        // Balanced — structured extraction
  analyze: 'claude-sonnet-4-6-20250929',      // Balanced — multi-step reasoning
  strategy: 'claude-opus-4-6',               // Expensive — complex financial advice
};

function selectModel(task: AgentTask): string {
  return MODEL_MAP[task];
}
```

## Best Practices
- Always set `max_tokens` explicitly — never rely on defaults
- Use `claude-haiku-4-6-20251001` for categorization/simple tasks (10x cheaper than Sonnet)
- Use `claude-sonnet-4-6-20250929` for parsing and analysis
- Stream long responses via SSE — never buffer >4KB in memory
- Validate ALL LLM JSON output with Zod before using
- Store agent interactions to Cognee for knowledge graph building
- Never log API keys — use `process.env.ANTHROPIC_API_KEY`

## Common Pitfalls
- **Tool loop without exit**: Always check `stop_reason === 'end_turn'` to exit the tool loop
- **Unvalidated JSON**: LLMs can return malformed JSON — always `JSON.parse` inside try/catch then Zod parse
- **Missing fallback**: Always implement OpenRouter fallback in case Anthropic API is down
- **Float money**: ALWAYS use integer cents — never floats for financial amounts
- **Token counting**: `max_tokens` in Anthropic SDK refers to OUTPUT tokens, not total context

## GoldLedger Application
- **Agent files**: `server/src/services/agents/` — each agent follows the tool-use loop pattern
- **Streaming route**: `server/src/routes/agent-streaming.ts` — SSE streaming via `streamSSE`
- **Circuit breaker**: Used in `server/src/services/agents/` — 5 failures → 60s cooldown → OpenRouter
- **Model selection**: Haiku for `categorizer`, `payment_matching`; Sonnet for `statement_parser`, `gst-calc`; Opus for `cdr_product`
- **Cognee search types**: CHUNKS for similarity, GRAPH_COMPLETION for reasoning, RAG_COMPLETION for GST rulings
- **Chat endpoint**: `server/src/routes/chat.ts` — fetches 50 recent transactions + Cognee multi-search

## References
- Anthropic SDK: https://docs.anthropic.com/en/api/getting-started
- Tool use guide: https://docs.anthropic.com/en/docs/build-with-claude/tool-use
- Streaming: https://docs.anthropic.com/en/api/messages-streaming
- OpenRouter: https://openrouter.ai/docs
