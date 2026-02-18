import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import type {
  GestureState,
  GestureConfig,
  GestureHandlers,
  UseTouchGesturesReturn,
} from './types.js';
import { DEFAULT_CONFIG, INITIAL_STATE, getDirection, isSwipeDetected } from './utils.js';

export function useTouchGestures(config: GestureConfig = {}): UseTouchGesturesReturn {
  const mergedConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
    [config],
  );

  const [state, setState] = useState<GestureState>(INITIAL_STATE);

  const gestureRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    isTracking: boolean;
  } | null>(null);

  const callbacksRef = useRef(config);
  useEffect(() => {
    callbacksRef.current = config;
  }, [config]);

  const reset = useCallback(() => {
    gestureRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (!mergedConfig.enabled) return;

      const now = performance.now();

      gestureRef.current = {
        startX: clientX,
        startY: clientY,
        startTime: now,
        lastX: clientX,
        lastY: clientY,
        lastTime: now,
        isTracking: true,
      };

      const newState: GestureState = {
        isActive: true,
        direction: null,
        deltaX: 0,
        deltaY: 0,
        velocityX: 0,
        velocityY: 0,
        isSwipe: false,
        startX: clientX,
        startY: clientY,
        currentX: clientX,
        currentY: clientY,
        elapsedTime: 0,
      };

      setState(newState);
      callbacksRef.current.onGestureStart?.(newState);
    },
    [mergedConfig.enabled],
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!gestureRef.current?.isTracking || !mergedConfig.enabled) return;

      const now = performance.now();
      const { startX, startY, startTime, lastX, lastY, lastTime } = gestureRef.current;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      const timeDelta = now - lastTime;

      let velocityX = 0;
      let velocityY = 0;
      if (timeDelta > 0) {
        velocityX = (clientX - lastX) / timeDelta;
        velocityY = (clientY - lastY) / timeDelta;
      }

      gestureRef.current.lastX = clientX;
      gestureRef.current.lastY = clientY;
      gestureRef.current.lastTime = now;

      const direction = getDirection(
        deltaX,
        deltaY,
        mergedConfig.horizontal,
        mergedConfig.vertical,
      );

      const isSwipe = isSwipeDetected(deltaX, deltaY, velocityX, velocityY, mergedConfig);

      const newState: GestureState = {
        isActive: true,
        direction,
        deltaX,
        deltaY,
        velocityX,
        velocityY,
        isSwipe,
        startX,
        startY,
        currentX: clientX,
        currentY: clientY,
        elapsedTime: now - startTime,
      };

      setState(newState);
      callbacksRef.current.onGestureMove?.(newState);
    },
    [mergedConfig],
  );

  const handleEnd = useCallback(() => {
    if (!gestureRef.current?.isTracking) return;

    const { startX, startY, startTime, lastX, lastY, lastTime } = gestureRef.current;
    const now = performance.now();

    const deltaX = lastX - startX;
    const deltaY = lastY - startY;
    const timeDelta = now - lastTime;

    let velocityX = 0;
    let velocityY = 0;
    if (timeDelta < 100) {
      velocityX = gestureRef.current
        ? (lastX - gestureRef.current.lastX) / Math.max(timeDelta, 1)
        : 0;
      velocityY = gestureRef.current
        ? (lastY - gestureRef.current.lastY) / Math.max(timeDelta, 1)
        : 0;
    }

    const direction = getDirection(deltaX, deltaY, mergedConfig.horizontal, mergedConfig.vertical);
    const isSwipe = isSwipeDetected(deltaX, deltaY, velocityX, velocityY, mergedConfig);

    const finalState: GestureState = {
      isActive: false,
      direction,
      deltaX,
      deltaY,
      velocityX,
      velocityY,
      isSwipe,
      startX,
      startY,
      currentX: lastX,
      currentY: lastY,
      elapsedTime: now - startTime,
    };

    gestureRef.current.isTracking = false;

    setState(finalState);
    callbacksRef.current.onGestureEnd?.(finalState);

    if (isSwipe && direction) {
      callbacksRef.current.onSwipe?.(direction, finalState);
    }

    setTimeout(() => {
      gestureRef.current = null;
      setState(INITIAL_STATE);
    }, 50);
  }, [mergedConfig]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (mergedConfig.preventDefault) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      if (!touch) return;
      handleStart(touch.clientX, touch.clientY);
    },
    [handleStart, mergedConfig.preventDefault],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (mergedConfig.preventDefault) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      if (!touch) return;
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove, mergedConfig.preventDefault],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (mergedConfig.preventDefault) {
        e.preventDefault();
      }
      handleEnd();
    },
    [handleEnd, mergedConfig.preventDefault],
  );

  const mouseCleanupRef = useRef<(() => void) | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      mouseCleanupRef.current?.();

      handleStart(e.clientX, e.clientY);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        handleMove(moveEvent.clientX, moveEvent.clientY);
      };

      const handleMouseUp = () => {
        handleEnd();
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        mouseCleanupRef.current = null;
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      mouseCleanupRef.current = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    },
    [handleStart, handleMove, handleEnd],
  );

  useEffect(() => {
    return () => {
      gestureRef.current = null;
      mouseCleanupRef.current?.();
      mouseCleanupRef.current = null;
    };
  }, []);

  const handlers: GestureHandlers = useMemo(
    () => ({
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown,
    }),
    [onTouchStart, onTouchMove, onTouchEnd, onMouseDown],
  );

  return {
    state,
    handlers,
    reset,
  };
}

export function useHorizontalSwipe(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  config?: Omit<GestureConfig, 'horizontal' | 'vertical' | 'onSwipe'>,
) {
  return useTouchGestures({
    ...config,
    horizontal: true,
    vertical: false,
    onSwipe: (direction) => {
      if (direction === 'left') onSwipeLeft?.();
      if (direction === 'right') onSwipeRight?.();
    },
  });
}

export function useVerticalSwipe(
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  config?: Omit<GestureConfig, 'horizontal' | 'vertical' | 'onSwipe'>,
) {
  return useTouchGestures({
    ...config,
    horizontal: false,
    vertical: true,
    onSwipe: (direction) => {
      if (direction === 'up') onSwipeUp?.();
      if (direction === 'down') onSwipeDown?.();
    },
  });
}
