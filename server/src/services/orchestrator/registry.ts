/**
 * Agent Registry — Barrel
 *
 * Re-exports all registry-related symbols:
 *  - agent-configs.ts    — AGENT_CONFIGS constant
 *  - registry-health.ts  — MetricsWindow, health management functions
 *  - registry-core.ts    — AgentRegistry class, agentRegistry singleton
 */

export * from './agent-configs.js';
export * from './registry-health.js';
export * from './registry-core.js';
