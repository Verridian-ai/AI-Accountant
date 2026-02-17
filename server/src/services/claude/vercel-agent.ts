/**
 * Vercel AI SDK — Abstract Base Agent
 *
 * Drop-in replacement pattern for `ClaudeAgent` that uses the Vercel AI SDK
 * (`generateText`, `streamText`) instead of the raw Anthropic SDK.
 *
 * Concrete agents extend this class, provide tools + a prompt builder, and
 * optionally supply a Zod `outputSchema` for type-safe structured output
 * via the `Output.object()` helper.
 *
 * Usage:
 * ```ts
 * class MyAgent extends VercelAgent<MyInput, MyOutput> {
 *   constructor() {
 *     super('budget_analyzer', SYSTEM_PROMPT, myOutputSchema);
 *   }
 *   getTools() { return { ... }; }
 *   buildPrompt(input: MyInput) { return JSON.stringify(input); }
 * }
 * ```
 */

import { generateText, streamText, Output, stepCountIs } from 'ai';
import type { ToolSet } from 'ai';
import type { z } from 'zod';
import type { AgentType, VercelAgentExecutionResult } from './types.js';
import { AGENT_TOKEN_BUDGETS } from './config.js';
import { resolveModel, VERCEL_SDK_CONFIG } from './vercel-provider.js';

// ---------------------------------------------------------------------------
// Abstract base
// ---------------------------------------------------------------------------

export abstract class VercelAgent<TInput, TOutput> {
  protected readonly agentType: AgentType;
  protected readonly systemPrompt: string;
  protected readonly outputSchema?: z.ZodSchema<TOutput>;

  constructor(agentType: AgentType, systemPrompt: string, outputSchema?: z.ZodSchema<TOutput>) {
    this.agentType = agentType;
    this.systemPrompt = systemPrompt;
    this.outputSchema = outputSchema;
  }

  // -----------------------------------------------------------------------
  // Abstract — subclasses must implement
  // -----------------------------------------------------------------------

  /** Return the Vercel AI SDK tools this agent can use. */
  abstract getTools(sessionId?: string): ToolSet;

  /** Turn typed input into the user-message prompt string. */
  abstract buildPrompt(input: TInput): string;

  // -----------------------------------------------------------------------
  // Model / budget helpers
  // -----------------------------------------------------------------------

  /** Resolve the LLM for this agent via the provider layer. */
  protected getModel() {
    return resolveModel(this.agentType);
  }

  /** Return the token budget configured for this agent type. */
  protected getTokenBudget() {
    return AGENT_TOKEN_BUDGETS[this.agentType];
  }

  // -----------------------------------------------------------------------
  // Core execution
  // -----------------------------------------------------------------------

  /**
   * Run the agent to completion.
   *
   * - If `outputSchema` was provided at construction, uses `generateText`
   *   with `output: Output.object()` which returns validated, typed output.
   * - Otherwise falls back to plain `generateText` and JSON-parses the
   *   response text.
   */
  async execute(input: TInput): Promise<VercelAgentExecutionResult<TOutput>> {
    const startMs = Date.now();
    const budget = this.getTokenBudget();
    const prompt = this.buildPrompt(input);
    const tools = this.getTools();

    if (this.outputSchema) {
      // Structured output path — the SDK validates against the Zod schema
      const result = await generateText({
        model: this.getModel(),
        system: this.systemPrompt,
        prompt,
        tools,
        output: Output.object({ schema: this.outputSchema }),
        temperature: VERCEL_SDK_CONFIG.temperature,
        maxRetries: VERCEL_SDK_CONFIG.maxRetries,
        maxOutputTokens: budget.maxOutputTokens,
        stopWhen: stepCountIs(budget.maxToolCalls + 1),
      });

      return {
        output: result.output,
        tokenUsage: result.usage
          ? {
              promptTokens: result.usage.inputTokens ?? 0,
              completionTokens: result.usage.outputTokens ?? 0,
              totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
            }
          : undefined,
        latencyMs: Date.now() - startMs,
        framework: 'vercel',
      };
    }

    // Text-based path — parse JSON from the model's text response
    const result = await generateText({
      model: this.getModel(),
      system: this.systemPrompt,
      prompt,
      tools,
      temperature: VERCEL_SDK_CONFIG.temperature,
      maxRetries: VERCEL_SDK_CONFIG.maxRetries,
      maxOutputTokens: budget.maxOutputTokens,
      stopWhen: stepCountIs(budget.maxToolCalls + 1),
    });

    const parsed = this.parseJsonOutput(result.text);

    return {
      output: parsed,
      tokenUsage: result.usage
        ? {
            promptTokens: result.usage.inputTokens ?? 0,
            completionTokens: result.usage.outputTokens ?? 0,
            totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
          }
        : undefined,
      latencyMs: Date.now() - startMs,
      framework: 'vercel',
    };
  }

  // -----------------------------------------------------------------------
  // Streaming
  // -----------------------------------------------------------------------

  /**
   * Stream the agent's text response chunk-by-chunk.
   *
   * Yields partial text deltas as they arrive from the model.
   * Callers can pipe these directly into an SSE connection.
   */
  async *stream(input: TInput): AsyncGenerator<string> {
    const budget = this.getTokenBudget();
    const prompt = this.buildPrompt(input);
    const tools = this.getTools();

    const result = streamText({
      model: this.getModel(),
      system: this.systemPrompt,
      prompt,
      tools,
      temperature: VERCEL_SDK_CONFIG.temperature,
      maxRetries: VERCEL_SDK_CONFIG.maxRetries,
      maxOutputTokens: budget.maxOutputTokens,
      stopWhen: stepCountIs(budget.maxToolCalls + 1),
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }

  // -----------------------------------------------------------------------
  // Fallback wrapper
  // -----------------------------------------------------------------------

  /**
   * Execute with automatic error recovery.
   *
   * On failure, returns a minimal fallback result so the calling pipeline
   * can continue rather than crash.  Subclasses can override
   * `buildFallbackOutput()` for a richer default.
   */
  async executeWithFallback(input: TInput): Promise<VercelAgentExecutionResult<TOutput>> {
    try {
      return await this.execute(input);
    } catch (error) {
      console.error(
        `[VercelAgent:${this.agentType}] Execution failed, returning fallback:`,
        error instanceof Error ? error.message : error,
      );

      return {
        output: this.buildFallbackOutput(input, error),
        latencyMs: 0,
        framework: 'vercel',
      };
    }
  }

  // -----------------------------------------------------------------------
  // Overridable helpers
  // -----------------------------------------------------------------------

  /**
   * Build a fallback output when execution fails.
   * Subclasses should override this to return a sensible default for their
   * output type.  The base implementation returns an object with a `summary`
   * field describing the error.
   */
  protected buildFallbackOutput(_input: TInput, error: unknown): TOutput {
    const message = error instanceof Error ? error.message : 'Unknown error during execution';
    return { summary: `Agent ${this.agentType} failed: ${message}` } as unknown as TOutput;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /**
   * Parse JSON from the model's text output.
   * Handles both raw JSON and markdown code-fenced JSON blocks.
   */
  private parseJsonOutput(text: string): TOutput {
    // Try extracting from markdown code fence first
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    const jsonStr = fenceMatch ? fenceMatch[1] : text;

    try {
      return JSON.parse(jsonStr.trim());
    } catch {
      // Try to find a JSON object anywhere in the text
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch {
          // fall through
        }
      }
      throw new Error(
        `[VercelAgent:${this.agentType}] Failed to parse JSON output: ${text.slice(0, 200)}`,
      );
    }
  }
}
