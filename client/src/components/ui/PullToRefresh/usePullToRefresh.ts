import { useRef, useCallback } from 'react';
import type { PullToRefreshRef, PullToRefreshState } from './types';

/**
 * Hook for managing pull-to-refresh state externally via a ref.
 */
export function usePullToRefresh(_onRefresh: () => Promise<void>) {
  const refreshRef = useRef<PullToRefreshRef>(null);

  const triggerRefresh = useCallback(async () => {
    await refreshRef.current?.refresh();
  }, []);

  const getState = useCallback((): PullToRefreshState => {
    return refreshRef.current?.getState() || 'idle';
  }, []);

  const reset = useCallback(() => {
    refreshRef.current?.reset();
  }, []);

  return {
    ref: refreshRef,
    triggerRefresh,
    getState,
    reset,
  };
}
