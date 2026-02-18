/**
 * Streaming Registry (Wave 21)
 *
 * Central registry of agents that support SSE streaming.
 * Other modules register their VercelAgent instances here;
 * the streaming routes look up agents by AgentType at runtime.
 */

import type { AgentType } from '../claude/types.js';
import type { VercelAgent } from '../claude/vercel-agent.js';

export class StreamingRegistry {
  private agents = new Map<AgentType, VercelAgent<unknown, unknown>>();

  /**
   * Register a VercelAgent instance so it can be invoked via SSE streaming.
   * Overwrites any previously registered agent for the same type.
   */
  register(agentType: AgentType, agent: VercelAgent<unknown, unknown>): void {
    this.agents.set(agentType, agent);
  }

  /**
   * Retrieve the registered VercelAgent for the given type, or `null`
   * if no agent has been registered for that type.
   */
  getAgent(agentType: AgentType): VercelAgent<unknown, unknown> | null {
    return this.agents.get(agentType) ?? null;
  }

  /**
   * Returns `true` if an agent has been registered for the given type.
   */
  isStreamingEnabled(agentType: AgentType): boolean {
    return this.agents.has(agentType);
  }

  /**
   * Returns an array of all AgentType values that have a registered
   * streaming-capable agent.
   */
  listStreamableAgents(): AgentType[] {
    return Array.from(this.agents.keys());
  }
}

export const streamingRegistry = new StreamingRegistry();
