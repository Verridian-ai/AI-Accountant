export interface MutationEvent {
  id: string;
  sessionId: string;
  agentType: string;
  mutationType: string;
  targetTable: string;
  description: string;
  status: string;
  confidence: number | null;
  requiresConfirmation: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  mutation_id: string | null;
  session_id: string | null;
  agent_type: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  before_state: string | null;
  after_state: string | null;
  metadata: string | null;
  user_id: string | null;
  created_at: string;
}

export interface StreamEvent {
  type: string;
  data: unknown;
  timestamp?: string;
}

