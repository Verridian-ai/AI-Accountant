/**
 * PullToRefresh Component
 *
 * A wrapper component that adds pull-to-refresh functionality to lists and scrollable content.
 * Supports both touch devices and mouse interactions for testing.
 *
 * Features:
 * - Customizable pull threshold and resistance
 * - Smooth spring animation on release
 * - Loading spinner with rotation animation
 * - Support for both touch and mouse events
 * - Configurable refresh callback
 *
 * NOTE: For enhanced animation support, consider installing:
 * - @use-gesture/react
 * - @react-spring/web
 */

import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { cn } from '../../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_THRESHOLD = 80;
const DEFAULT_MAX_PULL = 150;
const DEFAULT_RESISTANCE = 0.5;
const SPINNER_SIZE = 32;

// ============================================================================
// SPRING ANIMATION
// ============================================================================

function springAnimation(
  from: number,
  to: number,
  velocity: number,
  callback: (value: number) => void,
  onComplete?: () => void
): () => void {
  const stiffness = 400;
  const damping = 35;
  const mass = 1;

  let position = from;
  let vel = velocity;
  let lastTime = performance.now();
  let animationFrame: number;

  const step = (currentTime: number) => {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.064);
    lastTime = currentTime;

    const displacement = position - to;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * vel;
    const acceleration = (springForce + dampingForce) / mass;

    vel += acceleration * deltaTime;
    position += vel * deltaTime;

    callback(position);

    // Check if animation is complete
    if (Math.abs(position - to) < 0.5 && Math.abs(vel) < 0.5) {
      callback(to);
      onComplete?.();
      return;
    }

    animationFrame = requestAnimationFrame(step);
  };

  animationFrame = requestAnimationFrame(step);

  return () => {
    cancelAnimationFrame(animationFrame);
  };
}

// ============================================================================
// DEFAULT SPINNER COMPONENT
// ============================================================================

interface SpinnerProps {
  progress: number;
  state: PullToRefreshState;
  size?: number;
}

function DefaultSpinner({ progress, state, size = SPINNER_SIZE }: SpinnerProps) {
  const isRefreshing = state === 'refreshing';
  const rotation = isRefreshing ? 0 : progress * 360;
  const opacity = Math.min(progress, 1);
  const scale = Math.min(progress, 1);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <svg
        className={cn(
          'text-primary transition-colors',
          isRefreshing && 'animate-spin'
        )}
        style={{
          width: size,
          height: size,
          transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isRefreshing ? (
          // Spinner circle for refreshing state
          <>
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeOpacity="0.25"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
            />
          </>
        ) : (
          // Arrow for pulling state
          <>
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </>
        )}
      </svg>
      {state === 'ready' && !isRefreshing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PullToRefresh = forwardRef<PullToRefreshRef, PullToRefreshProps>(
  (
    {
      children,
      onRefresh,
      threshold = DEFAULT_THRESHOLD,
      maxPull = DEFAULT_MAX_PULL,
      resistance = DEFAULT_RESISTANCE,
      enabled = true,
      showSpinner = true,
      loadingIndicator,
      pullIndicator,
      className,
      contentClassName,
      onStateChange,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [state, setState] = useState<PullToRefreshState>('idle');

    // Tracking refs
    const dragRef = useRef<{
      startY: number;
      startScrollTop: number;
      lastY: number;
      lastTime: number;
      velocity: number;
      isTracking: boolean;
    } | null>(null);

    const cancelAnimation = useRef<(() => void) | null>(null);

    // Update state and notify
    const updateState = useCallback(
      (newState: PullToRefreshState) => {
        setState(newState);
        onStateChange?.(newState);
      },
      [onStateChange]
    );

    // Calculate progress (0-1) based on pull distance
    const progress = Math.min(pullDistance / threshold, 1.5);

    // ========================================================================
    // IMPERATIVE HANDLE
    // ========================================================================

    useImperativeHandle(ref, () => ({
      refresh: async () => {
        updateState('refreshing');
        setPullDistance(threshold * 0.8);
        try {
          await onRefresh();
        } finally {
          animateToIdle();
        }
      },
      getState: () => state,
      reset: () => {
        cancelAnimation.current?.();
        setPullDistance(0);
        updateState('idle');
      },
    }));

    // Use ref to track current pull distance to avoid stale closures
    const pullDistanceRef = useRef(pullDistance);
    pullDistanceRef.current = pullDistance;

    // ========================================================================
    // ANIMATION
    // ========================================================================

    const animateToIdle = useCallback(() => {
      cancelAnimation.current?.();

      cancelAnimation.current = springAnimation(
        pullDistanceRef.current,
        0,
        0,
        setPullDistance,
        () => {
          updateState('idle');
          cancelAnimation.current = null;
        }
      );
    }, [updateState]);

    const animateToRefreshing = useCallback(
      (velocity = 0) => {
        cancelAnimation.current?.();

        const targetPosition = threshold * 0.8;

        cancelAnimation.current = springAnimation(
          pullDistanceRef.current,
          targetPosition,
          velocity,
          setPullDistance,
          () => {
            cancelAnimation.current = null;
          }
        );
      },
      [threshold]
    );

    // ========================================================================
    // REFRESH HANDLER
    // ========================================================================

    const executeRefresh = useCallback(async () => {
      updateState('refreshing');
      animateToRefreshing();

      try {
        await onRefresh();
      } catch (error) {
        console.error('Pull to refresh error:', error);
      } finally {
        animateToIdle();
      }
    }, [onRefresh, updateState, animateToRefreshing, animateToIdle]);

    // ========================================================================
    // DRAG HANDLING
    // ========================================================================

    const canPull = useCallback(() => {
      if (!enabled) return false;
      if (state === 'refreshing') return false;

      // Check if content is scrolled to top
      const content = contentRef.current;
      if (!content) return true;

      return content.scrollTop <= 0;
    }, [enabled, state]);

    const handleDragStart = useCallback(
      (clientY: number) => {
        if (!canPull()) return;

        cancelAnimation.current?.();

        const content = contentRef.current;
        dragRef.current = {
          startY: clientY,
          startScrollTop: content?.scrollTop || 0,
          lastY: clientY,
          lastTime: performance.now(),
          velocity: 0,
          isTracking: true,
        };
      },
      [canPull]
    );

    const handleDragMove = useCallback(
      (clientY: number) => {
        if (!dragRef.current?.isTracking) return;

        const { startY, lastY, lastTime } = dragRef.current;
        const content = contentRef.current;

        // Check if we should start pulling
        const scrollTop = content?.scrollTop || 0;
        const deltaY = clientY - startY;

        // If scrolling up (content), don't pull
        if (scrollTop > 0 || (deltaY < 0 && pullDistance === 0)) {
          return;
        }

        // Calculate velocity
        const now = performance.now();
        const timeDelta = now - lastTime;
        if (timeDelta > 0) {
          dragRef.current.velocity = (clientY - lastY) / timeDelta;
          dragRef.current.lastY = clientY;
          dragRef.current.lastTime = now;
        }

        // Apply resistance to the pull
        const rawPull = Math.max(0, deltaY);
        const resistedPull = rawPull * (1 - resistance * (rawPull / maxPull));
        const constrainedPull = Math.min(resistedPull, maxPull);

        setPullDistance(constrainedPull);

        // Update state based on pull distance
        if (constrainedPull >= threshold) {
          if (state !== 'ready') {
            updateState('ready');
            // Haptic feedback if available
            if ('vibrate' in navigator) {
              navigator.vibrate(10);
            }
          }
        } else if (constrainedPull > 0) {
          if (state !== 'pulling') {
            updateState('pulling');
          }
        }
      },
      [pullDistance, threshold, maxPull, resistance, state, updateState]
    );

    const handleDragEnd = useCallback(() => {
      if (!dragRef.current?.isTracking) return;

      dragRef.current.isTracking = false;
      dragRef.current = null;

      if (state === 'ready' || pullDistance >= threshold) {
        // Execute refresh
        executeRefresh();
      } else {
        // Animate back to idle
        animateToIdle();
      }
    }, [state, pullDistance, threshold, executeRefresh, animateToIdle]);

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        handleDragStart(touch.clientY);
      },
      [handleDragStart]
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        handleDragMove(touch.clientY);

        // Prevent default only when pulling
        if (pullDistance > 0) {
          e.preventDefault();
        }
      },
      [handleDragMove, pullDistance]
    );

    const handleTouchEnd = useCallback(() => {
      handleDragEnd();
    }, [handleDragEnd]);

    // Mouse handlers for desktop testing
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        handleDragStart(e.clientY);

        const handleMouseMove = (moveEvent: MouseEvent) => {
          handleDragMove(moveEvent.clientY);
        };

        const handleMouseUp = () => {
          handleDragEnd();
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
      },
      [handleDragStart, handleDragMove, handleDragEnd]
    );

    // ========================================================================
    // CLEANUP
    // ========================================================================

    useEffect(() => {
      return () => {
        cancelAnimation.current?.();
      };
    }, []);

    // ========================================================================
    // RENDER
    // ========================================================================

    const indicatorHeight = Math.max(0, pullDistance);
    const showIndicator = pullDistance > 0 || state === 'refreshing';

    return (
      <div
        ref={containerRef}
        className={cn('relative overflow-hidden', className)}
      >
        {/* Pull indicator area */}
        <div
          className={cn(
            'absolute left-0 right-0 top-0 flex items-center justify-center',
            'transition-opacity duration-200',
            showIndicator ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            height: indicatorHeight,
            transform: `translateY(${-SPINNER_SIZE / 2}px)`,
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              transform: `translateY(${indicatorHeight / 2}px)`,
            }}
          >
            {pullIndicator ? (
              pullIndicator(progress, state)
            ) : loadingIndicator && state === 'refreshing' ? (
              loadingIndicator
            ) : showSpinner ? (
              <DefaultSpinner progress={progress} state={state} />
            ) : null}
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          className={cn(
            'relative overflow-auto',
            state !== 'refreshing' && 'touch-pan-y',
            contentClassName
          )}
          style={{
            transform: `translateY(${pullDistance}px)`,
            willChange: pullDistance > 0 ? 'transform' : undefined,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          {children}
        </div>
      </div>
    );
  }
);

PullToRefresh.displayName = 'PullToRefresh';

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for managing pull-to-refresh state externally
 */
export function usePullToRefresh(_onRefresh: () => Promise<void>) {
  const refreshRef = useRef<PullToRefreshRef>(null);

  const triggerRefresh = useCallback(async () => {
    await refreshRef.current?.refresh();
  }, []);

  const getState = useCallback(() => {
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

export default PullToRefresh;
