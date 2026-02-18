/**
 * Ambient module declarations for optional runtime dependencies.
 * These packages are loaded dynamically in try-catch blocks and may not be installed.
 */

// Langfuse is an optional observability tool loaded dynamically in orchestrator/tracing.ts
// If not installed, the code falls back to local tracing gracefully.
declare module 'langfuse';
