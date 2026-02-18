/**
 * Streaming Unredactor (v4 Pipeline)
 *
 * Replaces masked tokens (pseudonyms + [[amt:uuid]] tags) with real values
 * **inline** as chunks arrive from the Claude streaming response.
 *
 * Two integration modes:
 *
 * 1. **Node.js Transform stream** (`StreamingUnredactor`) — for piped stream
 *    architectures using `stream.pipe(unredactor).pipe(response)`.
 *
 * 2. **Async generator** (`wrapWithUnredactor`) — for `for await` loops,
 *    which is the primary integration point in the chat handler.
 *
 * Both handle the critical edge case of tokens split across chunk boundaries:
 * e.g. chunk 1 ends with "[[am" and chunk 2 starts with "t:abc123]]".
 * A tail buffer of `maxTokenLength` characters is retained between chunks.
 */

import { Transform } from 'node:stream';
import type { TransformCallback } from 'node:stream';
import type { TokenMap } from './token-map-builder.js';

const MIN_BUFFER_LENGTH = 20;

// ---------------------------------------------------------------------------
// Node.js Transform Stream
// ---------------------------------------------------------------------------

export class StreamingUnredactor extends Transform {
  private buffer = '';
  private readonly tokenEntries: ReadonlyArray<readonly [string, string]>;
  private readonly maxTokenLength: number;

  constructor(tokenMap: TokenMap) {
    super({ objectMode: true });

    // Pre-compute sorted entries (longest first for greedy matching)
    this.tokenEntries = [...tokenMap.all.entries()]
      .sort((a, b) => b[0].length - a[0].length)
      .map(([k, v]) => [k, v] as const);

    this.maxTokenLength =
      this.tokenEntries.length > 0
        ? Math.max(...this.tokenEntries.map(([k]) => k.length), MIN_BUFFER_LENGTH)
        : MIN_BUFFER_LENGTH;
  }

  _transform(chunk: Buffer | string, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');

    // Replace all known tokens in the buffer
    this.replaceTokens();

    // Keep the last maxTokenLength chars to catch tokens split across chunks
    const safeIndex = Math.max(0, this.buffer.length - this.maxTokenLength);
    const output = this.buffer.slice(0, safeIndex);
    this.buffer = this.buffer.slice(safeIndex);

    if (output.length > 0) {
      this.push(output);
    }

    callback();
  }

  _flush(callback: TransformCallback): void {
    // Final replacement pass on remaining buffer
    this.replaceTokens();

    if (this.buffer.length > 0) {
      this.push(this.buffer);
      this.buffer = '';
    }

    callback();
  }

  private replaceTokens(): void {
    for (const [masked, real] of this.tokenEntries) {
      if (this.buffer.includes(masked)) {
        this.buffer = this.buffer.replaceAll(masked, real);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Async generator wrapper (primary integration for chat handler)
// ---------------------------------------------------------------------------

/**
 * Wraps an async iterable of string chunks (e.g. from Claude SDK streaming)
 * with inline token replacement, yielding unredacted chunks.
 *
 * Usage:
 * ```ts
 * const tokenMap = tokenMapBuilder.buildTokenMap({ ... });
 * for await (const chunk of wrapWithUnredactor(claudeStream, tokenMap)) {
 *   writer.sendToken(chunk);
 * }
 * ```
 */
export async function* wrapWithUnredactor(
  stream: AsyncIterable<string>,
  tokenMap: TokenMap,
): AsyncGenerator<string> {
  // If token map is empty, pass through without buffering
  if (tokenMap.all.size === 0) {
    yield* stream;
    return;
  }

  // Pre-compute sorted entries (longest first)
  const entries = [...tokenMap.all.entries()].sort((a, b) => b[0].length - a[0].length);

  const maxTokenLen = Math.max(...entries.map(([k]) => k.length), MIN_BUFFER_LENGTH);

  let buffer = '';

  for await (const chunk of stream) {
    buffer += chunk;

    // Replace all known tokens
    for (const [masked, real] of entries) {
      if (buffer.includes(masked)) {
        buffer = buffer.replaceAll(masked, real);
      }
    }

    // Emit everything except the tail buffer
    const safeIndex = Math.max(0, buffer.length - maxTokenLen);
    if (safeIndex > 0) {
      yield buffer.slice(0, safeIndex);
      buffer = buffer.slice(safeIndex);
    }
  }

  // Flush remaining buffer with a final replacement pass
  for (const [masked, real] of entries) {
    if (buffer.includes(masked)) {
      buffer = buffer.replaceAll(masked, real);
    }
  }

  if (buffer.length > 0) {
    yield buffer;
  }
}
