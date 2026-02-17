import type { JobPriority } from './types.js';
import { PRIORITY_VALUES } from './types.js';

// ============================================================================
// PRIORITY QUEUE IMPLEMENTATION
// ============================================================================

export class PriorityQueue<T extends { priority: JobPriority; createdAt: string }> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
    this.items.sort((a, b) => {
      // First sort by priority (descending)
      const priorityDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      // Then by creation time (FIFO - ascending)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }

  remove(predicate: (item: T) => boolean): T | undefined {
    const index = this.items.findIndex(predicate);
    if (index !== -1) {
      return this.items.splice(index, 1)[0];
    }
    return undefined;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  findAll(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  get length(): number {
    return this.items.length;
  }

  toArray(): T[] {
    return [...this.items];
  }

  clear(): void {
    this.items = [];
  }

  boostPriority(predicate: (item: T) => boolean, newPriority: JobPriority): boolean {
    const item = this.find(predicate);
    if (item && PRIORITY_VALUES[newPriority] > PRIORITY_VALUES[item.priority]) {
      item.priority = newPriority;
      // Re-sort after priority change
      this.items.sort((a, b) => {
        const priorityDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      return true;
    }
    return false;
  }
}
