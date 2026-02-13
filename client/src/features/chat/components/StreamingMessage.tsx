import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface StreamingMessageProps {
  tokens: string[];
  isComplete: boolean;
  agentType?: string;
}

/**
 * Progressive text rendering with typing animation for SSE-streamed responses.
 * Displays tokens as they arrive via SSE, with a blinking cursor until complete.
 */
export function StreamingMessage({ tokens, isComplete, agentType }: StreamingMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [tokens.length]);

  const displayText = tokens.join('');

  return (
    <div
      ref={containerRef}
      className="neu-raised rounded-2xl rounded-bl-none px-4 py-3 border border-white/5 max-w-[85%]"
    >
      {/* Agent type badge */}
      {agentType && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-pulse" />
          <span className="text-[8px] font-black uppercase tracking-widest text-[#FFCC00]/70">
            {agentType.replace(/_/g, ' ')}
          </span>
        </div>
      )}

      {/* Streaming text with cursor */}
      <div className="text-xs font-medium text-zinc-200 leading-relaxed whitespace-pre-wrap">
        {displayText}
        {!isComplete && (
          <span className="inline-block w-0.5 h-3.5 bg-[#FFCC00] ml-0.5 align-middle animate-blink" />
        )}
      </div>

      {/* Streaming indicator */}
      {!isComplete && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex gap-0.5">
            <span
              className="w-1 h-1 rounded-full bg-[#FFCC00]/50 animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-1 h-1 rounded-full bg-[#FFCC00]/50 animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-1 h-1 rounded-full bg-[#FFCC00]/50 animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">
            Streaming
          </span>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
      `}</style>
    </div>
  );
}
