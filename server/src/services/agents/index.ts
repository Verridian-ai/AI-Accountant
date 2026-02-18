/**
 * Python Agent Service — Barrel Export
 *
 * TypeScript wrapper for Pydantic AI Python agents called via child_process.spawn.
 * For production AI agents, use AgentType from '../claude/types.js' instead.
 */

export * from './types.js';
export { agentService } from './agent-service.js';
export type { AgentType } from '../claude/types.js';
