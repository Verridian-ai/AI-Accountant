import { EventEmitter } from 'events';

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

// ============================================================================
// STRUCTURED SSE EVENT TYPES
// ============================================================================

export interface BatchProgressEvent {
  type: 'batch_progress';
  jobId: string;
  file: string;
  status: string;
  bank?: string;
  progress: { completed: number; total: number; failed: number };
}

export interface ParsingCompleteEvent {
  type: 'parsing_complete';
  statementId: string;
  transactionCount: number;
  accountId?: string | null;
  bankName?: string | null;
}

export interface TransferDetectedEvent {
  type: 'transfer_detected';
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  amount: number;
  confidence: number;
  linkId: string;
}

export interface EnrichmentStatusEvent {
  type: 'enrichment_status';
  transactionId: string;
  status: 'pending' | 'enriched' | 'failed';
  merchantName?: string;
  category?: string;
}

export interface VisionVerificationEvent {
  type: 'vision_verification';
  statementId: string;
  confidence: number;
  matches: number;
  discrepancies: number;
  needsReview: boolean;
}

export interface PipelineErrorEvent {
  type: 'pipeline_error';
  statementId: string;
  errorType: string;
  message: string;
}

export interface StatementUpdatedEvent {
  type: 'statement_updated';
  id: string;
  status: string;
  userId?: string;
  accountDetection?: unknown;
}

export interface TransactionsUpdatedEvent {
  type: 'transactions_updated';
}

export interface AccountsUpdatedEvent {
  type: 'accounts_updated';
}

export interface BASUpdatedEvent {
  type: 'bas_updated';
  userId?: string;
}

export interface TaxUpdatedEvent {
  type: 'tax_updated';
  userId?: string;
}

export interface MerchantMemoryUpdatedEvent {
  type: 'merchant_memory_updated';
}

export interface AccountSetupNeededEvent {
  type: 'account_setup_needed';
  statementId: string;
  userId?: string;
  detectedInfo: unknown;
}

export interface StatementAddedEvent {
  type: 'statement_added';
  id: string;
}

export type SSEEvent =
  | BatchProgressEvent
  | ParsingCompleteEvent
  | TransferDetectedEvent
  | EnrichmentStatusEvent
  | VisionVerificationEvent
  | PipelineErrorEvent
  | StatementUpdatedEvent
  | TransactionsUpdatedEvent
  | AccountsUpdatedEvent
  | BASUpdatedEvent
  | TaxUpdatedEvent
  | MerchantMemoryUpdatedEvent
  | AccountSetupNeededEvent
  | StatementAddedEvent;

// ============================================================================
// TYPED EMIT HELPERS
// ============================================================================

export const events = {
  emit(eventName: 'update', data: SSEEvent | Record<string, unknown>) {
    emitter.emit(eventName, data);
  },
  on(eventName: 'update', listener: (data: SSEEvent | Record<string, unknown>) => void) {
    emitter.on(eventName, listener);
  },
  off(eventName: 'update', listener: (data: SSEEvent | Record<string, unknown>) => void) {
    emitter.off(eventName, listener);
  },

  // Typed helper methods for each event type
  emitBatchProgress(data: Omit<BatchProgressEvent, 'type'>) {
    emitter.emit('update', { type: 'batch_progress', ...data });
  },
  emitParsingComplete(data: Omit<ParsingCompleteEvent, 'type'>) {
    emitter.emit('update', { type: 'parsing_complete', ...data });
  },
  emitTransferDetected(data: Omit<TransferDetectedEvent, 'type'>) {
    emitter.emit('update', { type: 'transfer_detected', ...data });
  },
  emitEnrichmentStatus(data: Omit<EnrichmentStatusEvent, 'type'>) {
    emitter.emit('update', { type: 'enrichment_status', ...data });
  },
  emitVisionVerification(data: Omit<VisionVerificationEvent, 'type'>) {
    emitter.emit('update', { type: 'vision_verification', ...data });
  },
  emitPipelineError(data: Omit<PipelineErrorEvent, 'type'>) {
    emitter.emit('update', { type: 'pipeline_error', ...data });
  },
  emitStatementUpdated(data: Omit<StatementUpdatedEvent, 'type'>) {
    emitter.emit('update', { type: 'statement_updated', ...data });
  },
};
