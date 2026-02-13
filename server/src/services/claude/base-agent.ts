/**
 * Claude Agent Framework — Base Agent Class
 *
 * Agentic tool-use loop with token tracking, budget enforcement,
 * and structured JSON output parsing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getClient } from './client.js';
import { AGENT_TOKEN_BUDGETS, AGENT_MODELS } from './config.js';
import { retryWithBackoff } from './retry.js';
import type { AgentType, TokenUsage } from './types.js';
import type { MutationTools } from './mutation-tools.js';

export abstract class ClaudeAgent<TInput, TOutput> {
  protected client: Anthropic;
  protected model: string;
  protected agentType: AgentType;

  /** Optional mutation tools — injected by orchestrator when mutation framework is active. */
  protected mutationTools?: MutationTools;

  /**
   * Set the MutationTools instance for this agent invocation.
   * Called by the orchestrator before invoke() when mutation support is needed.
   * Agents that don't use mutations are unaffected — this is backward-compatible.
   */
  setMutationTools(tools: MutationTools): void {
    this.mutationTools = tools;
  }

  /**
   * Check if mutation tools are available for this invocation.
   */
  protected hasMutationTools(): boolean {
    return this.mutationTools != null;
  }

  /** System prompt instructing the agent's role and output format. */
  protected abstract systemPrompt: string;

  /** Anthropic-formatted tool definitions. */
  protected abstract tools: Anthropic.Tool[];

  /** Map of tool name → async handler function. */
  protected abstract toolHandlers: Map<
    string,
    (input: Record<string, unknown>) => Promise<unknown>
  >;

  constructor(agentType: AgentType) {
    this.agentType = agentType;
    this.client = getClient();
    this.model = AGENT_MODELS[agentType];
  }

  /**
   * Invoke the agent with structured input, run the agentic tool-use loop,
   * and return parsed structured output.
   */
  async invoke(input: TInput): Promise<TOutput & { usage: TokenUsage }> {
    const budget = AGENT_TOKEN_BUDGETS[this.agentType];
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: 0,
    };

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Analyze the following input and return your result as a JSON object.\n\n${JSON.stringify(input, null, 2)}`,
      },
    ];

    // Per-tool circuit breaker: skip tools that fail 3 times in a row
    const toolFailures = new Map<string, number>();
    const TOOL_CIRCUIT_BREAKER_THRESHOLD = 3;

    let iterations = 0;
    const maxIterations = budget.maxToolCalls + 2; // safety ceiling

    while (iterations < maxIterations) {
      iterations++;

      const response = await retryWithBackoff(() =>
        this.client.messages.create({
          model: this.model,
          max_tokens: budget.maxOutputTokens,
          system: this.systemPrompt,
          tools: this.tools,
          messages,
        }),
      );

      // Track usage
      usage.inputTokens += response.usage?.input_tokens ?? 0;
      usage.outputTokens += response.usage?.output_tokens ?? 0;

      // Separate tool_use blocks from text blocks
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ContentBlock & { type: 'tool_use' } => b.type === 'tool_use',
      );

      // If no tool calls, extract final text answer
      if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(
          (b): b is Anthropic.ContentBlock & { type: 'text'; text: string } => b.type === 'text',
        );

        if (!textBlock) {
          throw new Error(`[${this.agentType}] No text response from agent`);
        }

        // If there were also tool_use blocks in the same response
        // but stop_reason is end_turn, we still take the text as final.
        // Only return if we actually have a text block and no tool calls.
        if (toolUseBlocks.length === 0) {
          const parsed = this.parseJsonOutput(textBlock.text);
          return { ...parsed, usage };
        }
      }

      // Budget check
      if (usage.toolCalls + toolUseBlocks.length > budget.maxToolCalls) {
        throw new Error(`[${this.agentType}] Tool call budget exceeded (${budget.maxToolCalls})`);
      }

      // Execute tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        usage.toolCalls++;

        // Circuit breaker: skip tools that have failed too many times
        const failures = toolFailures.get(toolUse.name) ?? 0;
        if (failures >= TOOL_CIRCUIT_BREAKER_THRESHOLD) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              error: `Tool "${toolUse.name}" circuit-breaked after ${failures} consecutive failures. Proceed without this tool.`,
            }),
            is_error: true,
          });
          continue;
        }

        const handler = this.toolHandlers.get(toolUse.name);

        if (!handler) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              error: `Unknown tool: ${toolUse.name}`,
            }),
            is_error: true,
          });
          continue;
        }

        try {
          const result = await handler(toolUse.input as Record<string, unknown>);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
          // Reset failure count on success
          toolFailures.set(toolUse.name, 0);
        } catch (err) {
          toolFailures.set(toolUse.name, failures + 1);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              error: err instanceof Error ? err.message : 'Tool execution failed',
            }),
            is_error: true,
          });
        }
      }

      // Continue conversation with assistant response + tool results
      messages.push({
        role: 'assistant',
        content: response.content as Anthropic.ContentBlock[],
      });
      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    throw new Error(`[${this.agentType}] Agent loop exceeded ${maxIterations} iterations`);
  }

  /**
   * Parse JSON from the agent's text output.
   * Handles both raw JSON and markdown code-fenced JSON.
   */
  private parseJsonOutput(text: string): TOutput {
    // Try extracting from markdown code fence first
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    const jsonStr = fenceMatch ? fenceMatch[1] : text;

    try {
      return JSON.parse(jsonStr.trim());
    } catch {
      // Try to find a JSON object in the text
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch {
          // fall through
        }
      }
      throw new Error(`[${this.agentType}] Failed to parse JSON output: ${text.slice(0, 200)}`);
    }
  }
}
