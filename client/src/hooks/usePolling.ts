import { useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for periodic polling with automatic cleanup and tab visibility handling.
 *
 * @param fetchFn - The function to call periodically
 * @param interval - Polling interval in milliseconds (default: 5000)
 * @param options - Additional options
 * @param options.pauseOnHidden - Whether to pause polling when the tab is hidden
 * @param options.enabled - Whether polling is currently enabled
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  interval = 5000,
  options: { pauseOnHidden?: boolean; enabled?: boolean } = { pauseOnHidden: true, enabled: true },
) {
  const { pauseOnHidden = true, enabled = true } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isComponentMounted = useRef<boolean>(true);

  const poll = useCallback(async () => {
    if (!enabled || !isComponentMounted.current) return;

    // Skip if tab is hidden and pauseOnHidden is true
    if (pauseOnHidden && document.visibilityState === 'hidden') {
      timeoutRef.current = setTimeout(poll, interval);
      return;
    }

    try {
      await fetchFn();
    } catch (error) {
      console.error('Polling error:', error);
    } finally {
      if (isComponentMounted.current) {
        timeoutRef.current = setTimeout(poll, interval);
      }
    }
  }, [fetchFn, interval, enabled, pauseOnHidden]);

  useEffect(() => {
    isComponentMounted.current = true;

    if (enabled) {
      poll();
    }

    return () => {
      isComponentMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [poll, enabled]);
}
