import { useCallback, useRef, useState, useMemo } from 'react';
import type { PinchState, PinchConfig, PinchHandlers, UsePinchReturn } from './types.js';
import { INITIAL_PINCH_STATE, getDistance, getCenter } from './utils.js';

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
      if (!touch1 || !touch2) return;
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
    [enabled, state.scale],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !pinchRef.current?.isActive || e.touches.length !== 2) return;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      if (!touch1 || !touch2) return;
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
    [enabled, minScale, maxScale, onPinch],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!pinchRef.current?.isActive) return;

      if (e.touches.length >= 2) return;

      pinchRef.current.isActive = false;

      setState((prev) => {
        const finalState = { ...prev, isActive: false };
        onPinchEnd?.(finalState);
        return finalState;
      });
    },
    [onPinchEnd],
  );

  const handlers: PinchHandlers = useMemo(
    () => ({
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    }),
    [onTouchStart, onTouchMove, onTouchEnd],
  );

  return {
    state,
    handlers,
    reset,
  };
}
