/**
 * LRU Cache Linked List Operations
 *
 * Node management utilities for the LRU (Least Recently Used) cache.
 * Handles doubly-linked list operations: move to front, remove, and evict.
 */

import type { CacheEntry } from './types.js';

// ============================================================================
// CACHE NODE TYPE
// ============================================================================

export interface CacheNode {
  key: string;
  entry: CacheEntry;
  prev: CacheNode | null;
  next: CacheNode | null;
}

// ============================================================================
// LINKED LIST OPERATIONS
// ============================================================================

/**
 * Move a node to the front of the linked list (most recently used)
 */
export function moveToFront(
  node: CacheNode,
  state: { head: CacheNode | null; tail: CacheNode | null },
): void {
  if (node === state.head) {
    return;
  }

  removeNode(node, state);

  node.prev = null;
  node.next = state.head;

  if (state.head) {
    state.head.prev = node;
  }
  state.head = node;

  if (!state.tail) {
    state.tail = node;
  }
}

/**
 * Remove a node from the linked list
 */
export function removeNode(
  node: CacheNode,
  state: { head: CacheNode | null; tail: CacheNode | null },
): void {
  if (node.prev) {
    node.prev.next = node.next;
  } else {
    state.head = node.next;
  }

  if (node.next) {
    node.next.prev = node.prev;
  } else {
    state.tail = node.prev;
  }
}

/**
 * Evict the least recently used entry (tail of the list)
 */
export function evictLRU(
  cache: Map<string, CacheNode>,
  state: { head: CacheNode | null; tail: CacheNode | null },
): void {
  if (!state.tail) {
    return;
  }

  const key = state.tail.key;
  removeNode(state.tail, state);
  cache.delete(key);
}
