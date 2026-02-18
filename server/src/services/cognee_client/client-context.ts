/**
 * CogneeClientContext — minimal interface for sub-module functions.
 *
 * Standalone functions in each sub-module accept this as their first
 * parameter, allowing them to call `ctx.authHeaders(userId?)` and
 * access `ctx.baseUrl` without depending on the full CogneeClient class.
 */

export interface CogneeClientContext {
  readonly baseUrl: string;
  authHeaders(userId?: string): Promise<Record<string, string>>;
}
