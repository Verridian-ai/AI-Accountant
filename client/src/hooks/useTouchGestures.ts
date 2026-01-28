/**
 * useTouchGestures Hook
 *
 * Custom hook for detecting and handling touch gestures.
 * Supports swipe detection with configurable thresholds and velocity tracking.
 * Works with both touch and mouse events for cross-device compatibility.
 *
 * NOTE: For enhanced gesture support, consider installing:
 * - @use-gesture/react
 * - @react-spring/web
 *
 * This implementation provides a vanilla approach that works without dependencies.
 */

import { useCallback, useRef, useState, useMemo, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface GestureState {
  /** Whether a gesture is currently active */
  isActive: boolean;
  /** Current direction of the swipe (null if no clear direction) */
  direction: SwipeDirection;
  /** Horizontal distance moved from start */
  deltaX: number;
  /** Vertical distance moved from start */
  deltaY: number;
  /** Current horizontal velocity (px/ms) */
  velocityX: number;
  /** Current vertical velocity (px/ms) */
  velocityY: number;
  /** Whether swipe threshold has been exceeded */
  isSwipe: boolean;
  /** Start position X */
  startX: number;
  /** Start position Y */
  startY: number;
  /** Current position X */
  currentX: number;
  /** Current position Y */
  currentY: number;
  /** Time since gesture started (ms) */
  elapsedTime: number;
}

export interface GestureConfig {
  /** Minimum distance (px) to trigger a swipe (default: 50) */
  swipeThreshold?: number;
  /** Minimum velocity (px/ms) to trigger a swipe (default: 0.3) */
  velocityThreshold?: number;
  /** Whether to track horizontal swipes (default: true) */
  horizontal?: boolean;
  /** Whether to track vertical swipes (default: true) */
  vertical?: boolean;
  /** Whether gesture tracking is enabled (default: true) */
  enabled?: boolean;
  /** Whether to prevent default touch behavior (default: false) */
  preventDefault?: boolean;
  /** Callback when swipe is detected */
  onSwipe?: (direction: SwipeDirection, state: GestureState) => void;
  /** Callback when gesture starts */
  onGestureStart?: (state: GestureState) => void;
  /** Callback during gesture movement */
  onGestureMove?: (state: GestureState) => void;
  /** Callback when gesture ends */
  onGestureEnd?: (state: GestureState) => void;
}

export interface GestureHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export interface UseTouchGesturesReturn {
  /** Current gesture state */
  state: GestureState;
  /** Event handlers to attach to the element */
  handlers: GestureHandlers;
  /** Reset gesture state manually */
  reset: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: Required<
  Omit<GestureConfig, 'onSwipe' | 'onGestureStart' | 'onGestureMove' | 'onGestureEnd'>
> = {
  swipeThreshold: 50,
  velocityThreshold: 0.3,
  horizontal: true,
  vertical: true,
  enabled: true,
  preventDefault: false,
};

const INITIAL_STATE: GestureState = {
  isActive: false,
  direction: null,
  deltaX: 0,
  deltaY: 0,
  velocityX: 0,
  velocityY: 0,
  isSwipe: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  elapsedTime: 0,
};

// ============================================================================
// UTILITIES
// ============================================================================

function getDirection(
  deltaX: number,
  deltaY: number,
  horizontal: boolean,
  vertical: boolean
): SwipeDirection {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  // Determine primary axis
  if (absX > absY && horizontal) {
    return deltaX > 0 ? 'right' : 'left';
  } else if (absY > absX && vertical) {
    return deltaY > 0 ? 'down' : 'up';
  }

  return null;
}

function isSwipeDetected(
  deltaX: number,
  deltaY: number,
  velocityX: number,
  velocityY: number,
  config: Required<
    Omit<GestureConfig, 'onSwipe' | 'onGestureStart' | 'onGestureMove' | 'onGestureEnd'>
  >
): boolean {
  const { swipeThreshold, velocityThreshold, horizontal, vertical } = config;

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const absVelX = Math.abs(velocityX);
  const absVelY = Math.abs(velocityY);

  // Check horizontal swipe
  if (horizontal && absX > absY) {
    return absX >= swipeThreshold || absVelX >= velocityThreshold;
  }

  // Check vertical swipe
  if (vertical && absY > absX) {
    return absY >= swipeThreshold || absVelY >= velocityThreshold;
  }

  return false;
}

// ============================================================================
// HOOK
// ============================================================================

export function useTouchGestures(config: GestureConfig = {}): UseTouchGesturesReturn {
  const mergedConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
    [
      config.swipeThreshold,
      config.velocityThreshold,
      config.horizontal,
      config.vertical,
      config.enabled,
      config.preventDefault,
    ]
  );

  const [state, setState] = useState<GestureState>(INITIAL_STATE);

  // Refs for tracking gesture without causing re-renders
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
  callbacksRef.current = config;

  // Reset function
  const reset = useCallback(() => {
    gestureRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // Handle gesture start
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
    [mergedConfig.enabled]
  );

  // Handle gesture move
  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!gestureRef.current?.isTracking || !mergedConfig.enabled) return;

      const now = performance.now();
      const { startX, startY, startTime, lastX, lastY, lastTime } = gestureRef.current;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      const timeDelta = now - lastTime;

      // Calculate velocity
      let velocityX = 0;
      let velocityY = 0;
      if (timeDelta > 0) {
        velocityX = (clientX - lastX) / timeDelta;
        velocityY = (clientY - lastY) / timeDelta;
      }

      // Update tracking refs
      gestureRef.current.lastX = clientX;
      gestureRef.current.lastY = clientY;
      gestureRef.current.lastTime = now;

      const direction = getDirection(
        deltaX,
        deltaY,
        mergedConfig.horizontal,
        mergedConfig.vertical
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
    [mergedConfig]
  );

  // Handle gesture end
  const handleEnd = useCallback(() => {
    if (!gestureRef.current?.isTracking) return;

    const { startX, startY, startTime, lastX, lastY, lastTime } = gestureRef.current;
    const now = performance.now();

    const deltaX = lastX - startX;
    const deltaY = lastY - startY;
    const timeDelta = now - lastTime;

    // Calculate final velocity (using last known velocity)
    let velocityX = 0;
    let velocityY = 0;
    if (timeDelta < 100) {
      // Only use recent velocity data
      velocityX = gestureRef.current
        ? (lastX - gestureRef.current.lastX) / Math.max(timeDelta, 1)
        : 0;
      velocityY = gestureRef.current
        ? (lastY - gestureRef.current.lastY) / Math.max(timeDelta, 1)
        : 0;
    }

    const direction = getDirection(
      deltaX,
      deltaY,
      mergedConfig.horizontal,
      mergedConfig.vertical
    );

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

    // Trigger swipe callback if swipe detected
    if (isSwipe && direction) {
      callbacksRef.current.onSwipe?.(direction, finalState);
    }

    // Reset state after a short delay
    setTimeout(() => {
      gestureRef.current = null;
      setState(INITIAL_STATE);
    }, 50);
  }, [mergedConfig]);

  // Touch event handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (mergedConfig.preventDefault) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    },
    [handleStart, mergedConfig.preventDefault]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (mergedConfig.preventDefault) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove, mergedConfig.preventDefault]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (mergedConfig.preventDefault) {
        e.preventDefault();
      }
      handleEnd();
    },
    [handleEnd, mergedConfig.preventDefault]
  );

  // Track mouse event cleanup functions
  const mouseCleanupRef = useRef<(() => void) | null>(null);

  // Mouse event handlers (for testing on desktop)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Clean up any existing mouse listeners
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

      // Store cleanup function
      mouseCleanupRef.current = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    },
    [handleStart, handleMove, handleEnd]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gestureRef.current = null;
      // Clean up any lingering mouse event listeners
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
    [onTouchStart, onTouchMove, onTouchEnd, onMouseDown]
  );

  return {
    state,
    handlers,
    reset,
  };
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook specifically for horizontal swipe detection
 */
export function useHorizontalSwipe(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  config?: Omit<GestureConfig, 'horizontal' | 'vertical' | 'onSwipe'>
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

/**
 * Hook specifically for vertical swipe detection
 */
export function useVerticalSwipe(
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  config?: Omit<GestureConfig, 'horizontal' | 'vertical' | 'onSwipe'>
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

// ============================================================================
// PINCH-TO-ZOOM HOOK
// ============================================================================

export interface PinchState {
  /** Whether pinch gesture is active */
  isActive: boolean;
  /** Current scale factor (1 = original size) */
  scale: number;
  /** Change in scale since last update */
  deltaScale: number;
  /** Center point X of the pinch */
  centerX: number;
  /** Center point Y of the pinch */
  centerY: number;
  /** Initial distance between fingers */
  initialDistance: number;
  /** Current distance between fingers */
  currentDistance: number;
}

export interface PinchConfig {
  /** Minimum scale allowed (default: 0.5) */
  minScale?: number;
  /** Maximum scale allowed (default: 3) */
  maxScale?: number;
  /** Whether pinch is enabled (default: true) */
  enabled?: boolean;
  /** Callback during pinch */
  onPinch?: (state: PinchState) => void;
  /** Callback when pinch ends */
  onPinchEnd?: (state: PinchState) => void;
}

export interface PinchHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export interface UsePinchReturn {
  state: PinchState;
  handlers: PinchHandlers;
  reset: () => void;
}

const INITIAL_PINCH_STATE: PinchState = {
  isActive: false,
  scale: 1,
  deltaScale: 0,
  centerX: 0,
  centerY: 0,
  initialDistance: 0,
  currentDistance: 0,
};

function getDistance(touch1: React.Touch, touch2: React.Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCenter(touch1: React.Touch, touch2: React.Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

export function usePinchToZoom(config: PinchConfig = {}): UsePinchReturn {
  const { minScale = 0.5, maxScale = 3, enabled = true, onPinch, onPinchEnd } = config;

  const [state, setState] = useState<PinchState>(INITIAL_PINCH_STATE);

  const pinchRef = useRef<{
    initialDistance: number;
    initialScale: number;
    isActive: boolean;
  } | null>(null);

  const reset = useCallback(() => {
    pinchRef.current = null;
    setState(INITIAL_PINCH_STATE);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 2) return;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = getDistance(touch1, touch2);
      const center = getCenter(touch1, touch2);

      pinchRef.current = {
        initialDistance: distance,
        initialScale: state.scale,
        isActive: true,
      };

      setState((prev) => ({
        ...prev,
        isActive: true,
        centerX: center.x,
        centerY: center.y,
        initialDistance: distance,
        currentDistance: distance,
      }));
    },
    [enabled, state.scale]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !pinchRef.current?.isActive || e.touches.length !== 2) return;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = getDistance(touch1, touch2);
      const center = getCenter(touch1, touch2);

      const { initialDistance, initialScale } = pinchRef.current;
      const rawScale = initialScale * (distance / initialDistance);
      const scale = Math.min(Math.max(rawScale, minScale), maxScale);
      const deltaScale = distance / initialDistance;

      const newState: PinchState = {
        isActive: true,
        scale,
        deltaScale,
        centerX: center.x,
        centerY: center.y,
        initialDistance,
        currentDistance: distance,
      };

      setState(newState);
      onPinch?.(newState);
    },
    [enabled, minScale, maxScale, onPinch]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!pinchRef.current?.isActive) return;

      // If we still have 2 fingers, don't end the pinch
      if (e.touches.length >= 2) return;

      pinchRef.current.isActive = false;

      setState((prev) => {
        const finalState = { ...prev, isActive: false };
        onPinchEnd?.(finalState);
        return finalState;
      });
    },
    [onPinchEnd]
  );

  const handlers: PinchHandlers = useMemo(
    () => ({
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    }),
    [onTouchStart, onTouchMove, onTouchEnd]
  );

  return {
    state,
    handlers,
    reset,
  };
}

export default useTouchGestures;
