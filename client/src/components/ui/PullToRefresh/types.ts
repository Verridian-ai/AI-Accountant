import type React from 'react';

export type PullToRefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing';

export interface PullToRefreshProps {
  /** Content to wrap with pull-to-refresh */
  children: React.ReactNode;
  /** Callback triggered when refresh is initiated */
  onRefresh: () => Promise<void>;
  /** Distance (px) required to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance (px) (default: 150) */
  maxPull?: number;
  /** Resistance factor (0-1) - higher = more resistance (default: 0.5) */
  resistance?: number;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
  /** Whether to show the default spinner (default: true) */
  showSpinner?: boolean;
  /** Custom loading indicator */
  loadingIndicator?: React.ReactNode;
  /** Custom pull indicator */
  pullIndicator?: (progress: number, state: PullToRefreshState) => React.ReactNode;
  /** Additional class name for container */
  className?: string;
  /** Additional class name for content wrapper */
  contentClassName?: string;
  /** Callback when pull state changes */
  onStateChange?: (state: PullToRefreshState) => void;
}

export interface PullToRefreshRef {
  /** Trigger refresh programmatically */
  refresh: () => Promise<void>;
  /** Get current state */
  getState: () => PullToRefreshState;
  /** Reset to idle state */
  reset: () => void;
}
