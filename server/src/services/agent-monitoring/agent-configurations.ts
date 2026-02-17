/**
 * Agent Monitoring — Configuration Management
 */

import { db } from '../../schema.js';
import { agentConfigurations } from '../../db/admin-schema.js';
import { eq } from 'drizzle-orm';
import { AGENT_MODELS, AGENT_TOKEN_BUDGETS } from '../claude/config.js';
import type { AgentType } from '../claude/types.js';
import type { AgentConfiguration } from '../../db/admin-schema.js';

// --------------------------------------------------------------------------
// Seed default agent configurations
// --------------------------------------------------------------------------

export async function seedAgentConfigurations(): Promise<void> {
  const agentTypes = Object.keys(AGENT_MODELS) as AgentType[];
  const now = new Date().toISOString();

  for (const agentType of agentTypes) {
    const model = AGENT_MODELS[agentType];
    const budget = AGENT_TOKEN_BUDGETS[agentType];

    await db
      .insert(agentConfigurations)
      .values({
        id: `config_${agentType}`,
        agentType,
        displayName: agentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        description: `Configuration for ${agentType} agent`,
        isEnabled: true,
        model,
        maxInputTokens: budget.maxInputTokens,
        maxOutputTokens: budget.maxOutputTokens,
        temperature: 0.1,
        toolsEnabled: '[]',
        rateLimitPerMinute: 10,
        rateLimitPerHour: 100,
        circuitBreakerThreshold: 5,
        circuitBreakerRecoveryMs: 60000,
        customConfig: '{}',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

// --------------------------------------------------------------------------
// Get all agent configurations
// --------------------------------------------------------------------------

export async function getAgentConfigurationList(): Promise<AgentConfiguration[]> {
  const configs: AgentConfiguration[] = await db.select().from(agentConfigurations).all();

  if (configs.length === 0) {
    await seedAgentConfigurations();
    return db.select().from(agentConfigurations).all();
  }

  return configs;
}

// --------------------------------------------------------------------------
// Update a single agent configuration
// --------------------------------------------------------------------------

export async function updateAgentConfig(
  agentType: string,
  updates: Partial<
    Pick<
      AgentConfiguration,
      | 'displayName'
      | 'description'
      | 'isEnabled'
      | 'model'
      | 'maxInputTokens'
      | 'maxOutputTokens'
      | 'temperature'
      | 'systemPromptOverride'
      | 'toolsEnabled'
      | 'rateLimitPerMinute'
      | 'rateLimitPerHour'
      | 'circuitBreakerThreshold'
      | 'circuitBreakerRecoveryMs'
      | 'customConfig'
    >
  >,
): Promise<AgentConfiguration | null> {
  await db
    .update(agentConfigurations)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(agentConfigurations.agentType, agentType))
    .run();

  const updated: AgentConfiguration | undefined = await db
    .select()
    .from(agentConfigurations)
    .where(eq(agentConfigurations.agentType, agentType))
    .get();

  return updated ?? null;
}
