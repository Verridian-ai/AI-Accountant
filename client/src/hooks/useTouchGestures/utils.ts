import type { GestureState, GestureConfig, SwipeDirection, PinchState } from './types.js';

export const DEFAULT_CONFIG: Required<
  Omit<GestureConfig, 'onSwipe' | 'onGestureStart' | 'onGestureMove' | 'onGestureEnd'>
> = {
  swipeThreshold: 50,
  velocityThreshold: 0.3,
  horizontal: true,
  vertical: true,
  enabled: true,
  preventDefault: false,
};

export const INITIAL_STATE: GestureState = {
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

export const INITIAL_PINCH_STATE: PinchState = {
  isActive: false,
  scale: 1,
  deltaScale: 0,
  centerX: 0,
  centerY: 0,
  initialDistance: 0,
  currentDistance: 0,
};

export function getDirection(
  deltaX: number,
  deltaY: number,
  horizontal: boolean,
  vertical: boolean,
): SwipeDirection {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX > absY && horizontal) {
    return deltaX > 0 ? 'right' : 'left';
  } else if (absY > absX && vertical) {
    return deltaY > 0 ? 'down' : 'up';
  }

  return null;
}

export function isSwipeDetected(
  deltaX: number,
  deltaY: number,
  velocityX: number,
  velocityY: number,
  config: Required<
    Omit<GestureConfig, 'onSwipe' | 'onGestureStart' | 'onGestureMove' | 'onGestureEnd'>
  >,
): boolean {
  const { swipeThreshold, velocityThreshold, horizontal, vertical } = config;

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const absVelX = Math.abs(velocityX);
  const absVelY = Math.abs(velocityY);

  if (horizontal && absX > absY) {
    return absX >= swipeThreshold || absVelX >= velocityThreshold;
  }

  if (vertical && absY > absX) {
    return absY >= swipeThreshold || absVelY >= velocityThreshold;
  }

  return false;
}

export function getDistance(touch1: React.Touch, touch2: React.Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getCenter(touch1: React.Touch, touch2: React.Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}
