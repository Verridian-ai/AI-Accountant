import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { cn } from '../../../lib/utils';
import type { PullToRefreshProps, PullToRefreshRef, PullToRefreshState } from './types';
import { DEFAULT_THRESHOLD, DEFAULT_MAX_PULL, DEFAULT_RESISTANCE, SPINNER_SIZE } from './constants';
import { springAnimation } from './springAnimation';
import { DefaultSpinner } from './DefaultSpinner';

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
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [state, setState] = useState<PullToRefreshState>('idle');

    const dragRef = useRef<{
      startY: number;
      startScrollTop: number;
      lastY: number;
      lastTime: number;
      velocity: number;
      isTracking: boolean;
    } | null>(null);

    const cancelAnimation = useRef<(() => void) | null>(null);

    const updateState = useCallback(
      (newState: PullToRefreshState) => {
        setState(newState);
        onStateChange?.(newState);
      },
      [onStateChange],
    );

    const progress = Math.min(pullDistance / threshold, 1.5);

    // Track pull distance in a ref to avoid stale closures
    const pullDistanceRef = useRef(pullDistance);
    pullDistanceRef.current = pullDistance;

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
        },
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
          },
        );
      },
      [threshold],
    );

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

    const canPull = useCallback(() => {
      if (!enabled) return false;
      if (state === 'refreshing') return false;
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
      [canPull],
    );

    const handleDragMove = useCallback(
      (clientY: number) => {
        if (!dragRef.current?.isTracking) return;
        const { startY, lastY, lastTime } = dragRef.current;
        const content = contentRef.current;
        const scrollTop = content?.scrollTop || 0;
        const deltaY = clientY - startY;

        if (scrollTop > 0 || (deltaY < 0 && pullDistance === 0)) {
          return;
        }

        const now = performance.now();
        const timeDelta = now - lastTime;
        if (timeDelta > 0) {
          dragRef.current.velocity = (clientY - lastY) / timeDelta;
          dragRef.current.lastY = clientY;
          dragRef.current.lastTime = now;
        }

        const rawPull = Math.max(0, deltaY);
        const resistedPull = rawPull * (1 - resistance * (rawPull / maxPull));
        const constrainedPull = Math.min(resistedPull, maxPull);

        setPullDistance(constrainedPull);

        if (constrainedPull >= threshold) {
          if (state !== 'ready') {
            updateState('ready');
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
      [pullDistance, threshold, maxPull, resistance, state, updateState],
    );

    const handleDragEnd = useCallback(() => {
      if (!dragRef.current?.isTracking) return;
      dragRef.current.isTracking = false;
      dragRef.current = null;

      if (state === 'ready' || pullDistance >= threshold) {
        executeRefresh();
      } else {
        animateToIdle();
      }
    }, [state, pullDistance, threshold, executeRefresh, animateToIdle]);

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        handleDragStart(touch.clientY);
      },
      [handleDragStart],
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        handleDragMove(touch.clientY);
        if (pullDistance > 0) {
          e.preventDefault();
        }
      },
      [handleDragMove, pullDistance],
    );

    const handleTouchEnd = useCallback(() => {
      handleDragEnd();
    }, [handleDragEnd]);

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
      [handleDragStart, handleDragMove, handleDragEnd],
    );

    useEffect(() => {
      return () => {
        cancelAnimation.current?.();
      };
    }, []);

    const indicatorHeight = Math.max(0, pullDistance);
    const showIndicator = pullDistance > 0 || state === 'refreshing';

    return (
      <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
        <div
          className={cn(
            'absolute left-0 right-0 top-0 flex items-center justify-center',
            'transition-opacity duration-200',
            showIndicator ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            height: indicatorHeight,
            transform: `translateY(${-SPINNER_SIZE / 2}px)`,
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{ transform: `translateY(${indicatorHeight / 2}px)` }}
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

        <div
          ref={contentRef}
          className={cn(
            'relative overflow-auto',
            state !== 'refreshing' && 'touch-pan-y',
            contentClassName,
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
  },
);

PullToRefresh.displayName = 'PullToRefresh';
