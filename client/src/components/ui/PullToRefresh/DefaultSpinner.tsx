import { cn } from '../../../lib/utils';
import type { PullToRefreshState } from './types';
import { SPINNER_SIZE } from './constants';

interface SpinnerProps {
  progress: number;
  state: PullToRefreshState;
  size?: number;
}

export function DefaultSpinner({ progress, state, size = SPINNER_SIZE }: SpinnerProps) {
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
        className={cn('text-primary transition-colors', isRefreshing && 'animate-spin')}
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
          <>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" />
          </>
        ) : (
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
