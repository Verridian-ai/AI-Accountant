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
