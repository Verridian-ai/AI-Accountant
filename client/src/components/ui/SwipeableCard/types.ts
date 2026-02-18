import type React from 'react';

export interface SwipeAction {
  /** Action identifier */
  id: string;
  /** Label text */
  label: string;
  /** Icon component or element */
  icon?: React.ReactNode;
  /** Background color class */
  bgColor: string;
  /** Text color class */
  textColor?: string;
  /** Action callback */
  onAction: () => void;
}

export interface SwipeableCardProps {
  /** Card content */
  children: React.ReactNode;
  /** Actions for left swipe (shown on right side) */
  leftActions?: SwipeAction[];
  /** Actions for right swipe (shown on left side) */
  rightActions?: SwipeAction[];
  /** Whether swiping is disabled */
  disabled?: boolean;
  /** Swipe threshold as percentage of card width (default: 0.3) */
  swipeThreshold?: number;
  /** Maximum swipe distance as percentage (default: 0.5) */
  maxSwipe?: number;
  /** Callback when card is opened */
  onOpen?: (direction: 'left' | 'right') => void;
  /** Callback when card is closed */
  onClose?: () => void;
  /** Additional class name */
  className?: string;
  /** Whether to reset position after action (default: true) */
  resetAfterAction?: boolean;
}

export interface SwipeableCardRef {
  open: (direction: 'left' | 'right') => void;
  close: () => void;
  reset: () => void;
}
