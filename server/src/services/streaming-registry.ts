/**
 * Streaming Registry (Wave 21)
 *
 * Central registry of agents that support SSE streaming.
 * Other modules register their VercelAgent instances here;
 * the streaming routes look up agents by AgentType at runtime.
 */

import type { AgentType } from './claude/types.js';
import type { VercelAgent } from './claude/vercel-agent.js';

// ============================================================================
// STREAMING REGISTRY
// ============================================================================

export class StreamingRegistry {
  private agents = new Map<AgentType, VercelAgent<any, any>>();

  // --------------------------------------------------------------------------
  // Register an agent for streaming
  // --------------------------------------------------------------------------

  /**
   * Register a VercelAgent instance so it can be invoked via SSE streaming.
   * Overwrites any previously registered agent for the same type.
   */
  register(agentType: AgentType, agent: VercelAgent<any, any>): void {
    this.agents.set(agentType, agent);
  }

  // --------------------------------------------------------------------------
  // Look up a registered agent
  // --------------------------------------------------------------------------

  /**
   * Retrieve the registered VercelAgent for the given type, or `null`
   * if no agent has been registered for that type.
   */
  getAgent(agentType: AgentType): VercelAgent<any, any> | null {
    return this.agents.get(agentType) ?? null;
  }

  // --------------------------------------------------------------------------
  // Check whether streaming is available for a given agent type
  // --------------------------------------------------------------------------

  /**
   * Returns `true` if an agent has been registered for the given type.
   */
  isStreamingEnabled(agentType: AgentType): boolean {
    return this.agents.has(agentType);
  }

  // --------------------------------------------------------------------------
  // List all streamable agent types
  // --------------------------------------------------------------------------

  /**
   * Returns an array of all AgentType values that have a registered
   * streaming-capable agent.
   */
  listStreamableAgents(): AgentType[] {
    return Array.from(this.agents.keys());
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const streamingRegistry = new StreamingRegistry();
