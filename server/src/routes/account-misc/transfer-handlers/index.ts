import type { Hono } from 'hono';
import { registerTransferLinkOps } from './link-ops.js';
import { registerTransferDetectOps } from './detect-ops.js';
import { registerTransferQueryOps } from './query-ops.js';

export function registerTransferHandlers(app: Hono): void {
  registerTransferLinkOps(app);
  registerTransferDetectOps(app);
  registerTransferQueryOps(app);
}
