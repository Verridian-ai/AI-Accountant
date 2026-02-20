/* eslint-disable react-refresh/only-export-components */
/**
 * BottomSheet Component
 *
 * Mobile-optimized modal that slides up from the bottom.
 * Features draggable handle, snap points, backdrop blur, and safe area support.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useId,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface BottomSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when sheet should close */
  onClose: () => void;
  /** Sheet content */
  children: React.ReactNode;
  /** Snap points as percentages of viewport height (default: [50, 90]) */
  snapPoints?: number[];
  /** Initial snap point index (default: 0) */
  initialSnap?: number;
  /** Whether to show backdrop (default: true) */
  showBackdrop?: boolean;
  /** Whether clicking backdrop closes sheet (default: true) */
  closeOnBackdrop?: boolean;
  /** Whether to close on escape key (default: true) */
  closeOnEscape?: boolean;
  /** Whether to block body scroll when open (default: true) */
  blockScroll?: boolean;
  /** Sheet title for accessibility */
  title?: string;
  /** Additional class name for the sheet */
  className?: string;
  /** Callback when snap point changes */
  onSnapChange?: (snapIndex: number) => void;
}

export interface BottomSheetRef {
  snapTo: (index: number) => void;
  expand: () => void;
  collapse: () => void;
  close: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_SNAP_POINTS = [50, 90];
const VELOCITY_THRESHOLD = 0.5; // Velocity threshold for quick swipes

// ============================================================================
// COMPONENT
// ============================================================================

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  (
    {
      open,
      onClose,
      children,
      snapPoints = DEFAULT_SNAP_POINTS,
      initialSnap = 0,
      showBackdrop = true,
      closeOnBackdrop = true,
      closeOnEscape = true,
      blockScroll = true,
      title,
      className,
      onSnapChange,
    },
    ref,
  ) => {
    const sheetRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
      startY: number;
      startHeight: number;
      lastY: number;
      lastTime: number;
      velocity: number;
    } | null>(null);

    const [_currentSnapIndex, setCurrentSnapIndex] = useState(initialSnap);
    const [isDragging, setIsDragging] = useState(false);
    const [height, setHeight] = useState(snapPoints[initialSnap]);
    const [isAnimating, setIsAnimating] = useState(false);
    const componentId = useId().replace(/:/g, '');

    // Refs for cleanup
    const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const snapPointsKey = snapPoints.join(',');
    const sortedSnapPoints = useMemo(
      () =>
        snapPointsKey
          .split(',')
          .map(Number)
          .sort((a, b) => a - b),
      [snapPointsKey],
    );

    // ========================================================================
    // ANIMATION
    // ========================================================================

    const animateToSnap = useCallback(
      (snapIndex: number) => {
        setIsAnimating(true);
        setCurrentSnapIndex(snapIndex);
        setHeight(sortedSnapPoints[snapIndex]);
        onSnapChange?.(snapIndex);

        // Clear any existing animation timer
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current);
        }

        // Remove animation class after transition
        animationTimerRef.current = setTimeout(() => {
          setIsAnimating(false);
          animationTimerRef.current = null;
        }, 300);
      },
      [sortedSnapPoints, onSnapChange],
    );

    const animateClose = useCallback(() => {
      setIsAnimating(true);
      setHeight(0);

      // Clear any existing close timer
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }

      closeTimerRef.current = setTimeout(() => {
        setIsAnimating(false);
        closeTimerRef.current = null;
        onClose();
      }, 300);
    }, [onClose]);

    // Cleanup timers on unmount
    useEffect(() => {
      return () => {
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current);
        }
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
        }
      };
    }, []);

    // ========================================================================
    // IMPERATIVE HANDLE
    // ========================================================================

    useImperativeHandle(ref, () => ({
      snapTo: (index: number) => {
        if (index >= 0 && index < sortedSnapPoints.length) {
          animateToSnap(index);
        }
      },
      expand: () => {
        animateToSnap(sortedSnapPoints.length - 1);
      },
      collapse: () => {
        animateToSnap(0);
      },
      close: onClose,
    }));

    // ========================================================================
    // DRAG HANDLING
    // ========================================================================

    const handleDragStart = useCallback(
      (clientY: number) => {
        dragRef.current = {
          startY: clientY,
          startHeight: height ?? sortedSnapPoints[0] ?? 50,
          lastY: clientY,
          lastTime: Date.now(),
          velocity: 0,
        };
        setIsDragging(true);
      },
      [height, sortedSnapPoints],
    );

    const handleDragMove = useCallback((clientY: number) => {
      if (!dragRef.current) return;

      const { startY, startHeight, lastY, lastTime } = dragRef.current;
      const deltaY = startY - clientY;
      const deltaPercent = (deltaY / window.innerHeight) * 100;
      const newHeight = Math.max(0, Math.min(100, startHeight + deltaPercent));

      // Calculate velocity
      const now = Date.now();
      const timeDelta = now - lastTime;
      if (timeDelta > 0) {
        const velocity = (lastY - clientY) / timeDelta;
        dragRef.current.velocity = velocity;
        dragRef.current.lastY = clientY;
        dragRef.current.lastTime = now;
      }

      setHeight(newHeight);
    }, []);

    const handleDragEnd = useCallback(() => {
      if (!dragRef.current) return;

      const { velocity } = dragRef.current;

      setIsDragging(false);
      dragRef.current = null;

      const currentHeight = height ?? sortedSnapPoints[0] ?? 50;
      const firstSnap = sortedSnapPoints[0] ?? 50;

      // Handle quick swipes
      if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
        if (velocity > 0) {
          // Swiped up - expand
          const nextSnap = sortedSnapPoints.findIndex((sp) => sp > currentHeight);
          if (nextSnap !== -1) {
            animateToSnap(nextSnap);
          } else {
            animateToSnap(sortedSnapPoints.length - 1);
          }
        } else {
          // Swiped down - collapse or close
          if (currentHeight < firstSnap / 2) {
            animateClose();
          } else {
            const prevSnap = [...sortedSnapPoints].reverse().findIndex((sp) => sp < currentHeight);
            const actualIndex = prevSnap !== -1 ? sortedSnapPoints.length - 1 - prevSnap : 0;
            animateToSnap(actualIndex);
          }
        }
        return;
      }

      // Handle regular drag - snap to nearest point or close
      if (currentHeight < firstSnap / 2) {
        animateClose();
        return;
      }

      // Find nearest snap point
      let nearestSnap = 0;
      let minDistance = Math.abs(currentHeight - firstSnap);

      for (let i = 1; i < sortedSnapPoints.length; i++) {
        const snapPoint = sortedSnapPoints[i];
        if (snapPoint === undefined) continue;
        const distance = Math.abs(currentHeight - snapPoint);
        if (distance < minDistance) {
          minDistance = distance;
          nearestSnap = i;
        }
      }

      animateToSnap(nearestSnap);
    }, [height, sortedSnapPoints, animateToSnap, animateClose]);

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        handleDragStart(e.clientY);
      },
      [handleDragStart],
    );

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        handleDragStart(touch.clientY);
      },
      [handleDragStart],
    );

    useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e: MouseEvent) => {
        handleDragMove(e.clientY);
      };

      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        handleDragMove(touch.clientY);
      };

      const handleEnd = () => {
        handleDragEnd();
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleEnd);
      };
    }, [isDragging, handleDragMove, handleDragEnd]);

    // ========================================================================
    // KEYBOARD HANDLING
    // ========================================================================

    useEffect(() => {
      if (!open || !closeOnEscape) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, closeOnEscape, onClose]);

    // ========================================================================
    // BODY SCROLL LOCK
    // ========================================================================

    useEffect(() => {
      if (!open || !blockScroll) return;

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }, [open, blockScroll]);

    // ========================================================================
    // OPEN STATE HANDLING
    // ========================================================================

    useEffect(() => {
      if (open) {
        // eslint-disable-next-line
        setTimeout(() => {
          setHeight(sortedSnapPoints[initialSnap]);
          setCurrentSnapIndex(initialSnap);
        }, 0);
      }
    }, [open, initialSnap, sortedSnapPoints]);

    // ========================================================================
    // RENDER
    // ========================================================================

    if (!open && height === 0) {
      return null;
    }

    const sheetContent = (
      <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
        {/* Backdrop */}
        {showBackdrop && (
          <div
            className={cn(
              'absolute inset-0 bg-black/50 backdrop-blur-sm',
              isAnimating && 'transition-opacity duration-300',
              height === 0 ? 'opacity-0' : 'opacity-100',
            )}
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />
        )}

        {/* Sheet */}
        <style>{`.bottom-sheet-${componentId} { height: ${height}vh; padding-bottom: env(safe-area-inset-bottom, 0px); }`}</style>
        <div
          ref={sheetRef}
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-dark-surface rounded-t-3xl shadow-2xl',
            'flex flex-col overflow-hidden max-h-[95vh]',
            isAnimating && !isDragging && 'transition-all duration-300 ease-out',
            `bottom-sheet-${componentId}`,
            className,
          )}
        >
          {/* Drag Handle */}
          <div
            className={cn(
              'shrink-0 pt-3 pb-2 cursor-grab active:cursor-grabbing',
              'touch-none select-none',
            )}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <div className="w-10 h-1 mx-auto rounded-full bg-overlay-hover" />
          </div>

          {/* Title (optional) */}
          {title && (
            <div className="px-6 pb-3 border-b border-border">
              <h2 className="text-lg font-semibold text-primary">{title}</h2>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">{children}</div>
        </div>
      </div>
    );

    return createPortal(sheetContent, document.body);
  },
);

BottomSheet.displayName = 'BottomSheet';

// ============================================================================
// CONVENIENCE HOOK
// ============================================================================

export function useBottomSheet(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  const ref = useRef<BottomSheetRef>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    ref,
    props: {
      open: isOpen,
      onClose: close,
      ref,
    },
  };
}

export default BottomSheet;
