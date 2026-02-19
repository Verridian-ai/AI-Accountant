import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { cn } from '../../../lib/utils';
import type { SwipeAction, SwipeableCardProps, SwipeableCardRef } from './types';
import { VELOCITY_THRESHOLD, ACTION_WIDTH } from './constants';
import { springAnimation } from './springAnimation';

export const SwipeableCard = forwardRef<SwipeableCardRef, SwipeableCardProps>(
  (
    {
      children,
      leftActions = [],
      rightActions = [],
      disabled = false,
      swipeThreshold = 0.3,
      // maxSwipe is available for future use
      maxSwipe: _maxSwipe = 0.5,
      onOpen,
      onClose,
      className,
      resetAfterAction = true,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [offset, setOffset] = useState(0);
    const [isOpen, setIsOpen] = useState<'left' | 'right' | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const dragRef = useRef<{
      startX: number;
      startOffset: number;
      lastX: number;
      lastTime: number;
      velocity: number;
    } | null>(null);

    const cancelAnimation = useRef<(() => void) | null>(null);

    // Calculate maximum offset based on action count
    const maxLeftOffset = leftActions.length * ACTION_WIDTH;
    const maxRightOffset = rightActions.length * ACTION_WIDTH;

    // Cleanup animation on unmount
    useEffect(() => {
      return () => {
        cancelAnimation.current?.();
      };
    }, []);

    // ========================================================================
    // ANIMATION
    // ========================================================================

    const animateTo = useCallback(
      (targetOffset: number, velocity = 0) => {
        cancelAnimation.current?.();
        setIsAnimating(true);

        cancelAnimation.current = springAnimation(offset, targetOffset, velocity, setOffset, () => {
          setIsAnimating(false);
          cancelAnimation.current = null;
        });
      },
      [offset],
    );

    // ========================================================================
    // IMPERATIVE HANDLE
    // ========================================================================

    useImperativeHandle(ref, () => ({
      open: (direction: 'left' | 'right') => {
        if (direction === 'left' && leftActions.length > 0) {
          animateTo(-maxLeftOffset);
          setIsOpen('left');
          onOpen?.('left');
        } else if (direction === 'right' && rightActions.length > 0) {
          animateTo(maxRightOffset);
          setIsOpen('right');
          onOpen?.('right');
        }
      },
      close: () => {
        animateTo(0);
        setIsOpen(null);
        onClose?.();
      },
      reset: () => {
        setOffset(0);
        setIsOpen(null);
      },
    }));

    // ========================================================================
    // DRAG HANDLING
    // ========================================================================

    const handleDragStart = useCallback(
      (clientX: number) => {
        if (disabled) return;

        cancelAnimation.current?.();

        dragRef.current = {
          startX: clientX,
          startOffset: offset,
          lastX: clientX,
          lastTime: performance.now(),
          velocity: 0,
        };
      },
      [disabled, offset],
    );

    const handleDragMove = useCallback(
      (clientX: number) => {
        if (!dragRef.current || disabled) return;

        const { startX, startOffset, lastX, lastTime } = dragRef.current;
        const deltaX = clientX - startX;
        let newOffset = startOffset + deltaX;

        // Apply constraints
        const maxPositive = rightActions.length > 0 ? maxRightOffset : 0;
        const maxNegative = leftActions.length > 0 ? -maxLeftOffset : 0;

        // Apply elastic resistance past bounds
        if (newOffset > maxPositive) {
          const excess = newOffset - maxPositive;
          newOffset = maxPositive + excess * 0.3;
        } else if (newOffset < maxNegative) {
          const excess = maxNegative - newOffset;
          newOffset = maxNegative - excess * 0.3;
        }

        // Calculate velocity
        const now = performance.now();
        const timeDelta = now - lastTime;
        if (timeDelta > 0) {
          dragRef.current.velocity = (clientX - lastX) / timeDelta;
          dragRef.current.lastX = clientX;
          dragRef.current.lastTime = now;
        }

        setOffset(newOffset);
      },
      [disabled, leftActions.length, rightActions.length, maxLeftOffset, maxRightOffset],
    );

    const handleDragEnd = useCallback(() => {
      if (!dragRef.current || disabled) return;

      const { velocity } = dragRef.current;
      dragRef.current = null;

      const containerWidth = containerRef.current?.offsetWidth || 300;
      const threshold = containerWidth * swipeThreshold;

      // Handle quick swipes
      if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
        if (velocity < 0 && leftActions.length > 0) {
          animateTo(-maxLeftOffset, velocity * 1000);
          setIsOpen('left');
          onOpen?.('left');
        } else if (velocity > 0 && rightActions.length > 0) {
          animateTo(maxRightOffset, velocity * 1000);
          setIsOpen('right');
          onOpen?.('right');
        } else {
          animateTo(0, velocity * 1000);
          setIsOpen(null);
          onClose?.();
        }
        return;
      }

      // Handle regular drag
      if (offset < -threshold && leftActions.length > 0) {
        animateTo(-maxLeftOffset);
        setIsOpen('left');
        onOpen?.('left');
      } else if (offset > threshold && rightActions.length > 0) {
        animateTo(maxRightOffset);
        setIsOpen('right');
        onOpen?.('right');
      } else {
        animateTo(0);
        setIsOpen(null);
        if (isOpen) {
          onClose?.();
        }
      }
    }, [
      disabled,
      offset,
      swipeThreshold,
      leftActions.length,
      rightActions.length,
      maxLeftOffset,
      maxRightOffset,
      animateTo,
      isOpen,
      onOpen,
      onClose,
    ]);

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        handleDragStart(touch.clientX);
      },
      [handleDragStart],
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        handleDragMove(touch.clientX);
      },
      [handleDragMove],
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        handleDragStart(e.clientX);

        const handleMouseMove = (moveEvent: MouseEvent) => {
          handleDragMove(moveEvent.clientX);
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

    const handleActionClick = useCallback(
      (action: SwipeAction) => {
        action.onAction();
        if (resetAfterAction) {
          animateTo(0);
          setIsOpen(null);
        }
      },
      [resetAfterAction, animateTo],
    );

    // ========================================================================
    // RENDER
    // ========================================================================

    // Calculate action button visibility based on offset
    const leftActionsVisible = offset < 0;
    const rightActionsVisible = offset > 0;

    return (
      <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
        {/* Right side actions (shown when swiping left) */}
        {leftActions.length > 0 && (
          <div
            className="absolute inset-y-0 right-0 flex"
            style={{
              opacity: leftActionsVisible ? 1 : 0,
              pointerEvents: leftActionsVisible ? 'auto' : 'none',
            }}
          >
            {leftActions.map((action) => (
              <button
                key={action.id}
                className={cn(
                  'flex flex-col items-center justify-center px-4',
                  'transition-opacity',
                  action.bgColor,
                  action.textColor || 'text-primary',
                )}
                style={{ width: ACTION_WIDTH }}
                onClick={() => handleActionClick(action)}
              >
                {action.icon && <span className="mb-1">{action.icon}</span>}
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Left side actions (shown when swiping right) */}
        {rightActions.length > 0 && (
          <div
            className="absolute inset-y-0 left-0 flex"
            style={{
              opacity: rightActionsVisible ? 1 : 0,
              pointerEvents: rightActionsVisible ? 'auto' : 'none',
            }}
          >
            {rightActions.map((action) => (
              <button
                key={action.id}
                className={cn(
                  'flex flex-col items-center justify-center px-4',
                  'transition-opacity',
                  action.bgColor,
                  action.textColor || 'text-primary',
                )}
                style={{ width: ACTION_WIDTH }}
                onClick={() => handleActionClick(action)}
              >
                {action.icon && <span className="mb-1">{action.icon}</span>}
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Card content */}
        <div
          className={cn('relative bg-dark-surface', !isAnimating && 'touch-pan-y')}
          style={{
            transform: `translateX(${offset}px)`,
            willChange: isAnimating ? 'transform' : undefined,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleMouseDown}
        >
          {children}
        </div>
      </div>
    );
  },
);

SwipeableCard.displayName = 'SwipeableCard';
