/**
 * StreamingChat — Main streaming chat component with token-by-token rendering
 *
 * Connects to POST /api/stream/agent/:agentType via ReadableStream SSE.
 * Neumorphic dark theme with gold (#FFCC00) accents.
 */

import { useState, useRef, useEffect } from 'react';
import { useStreaming } from '../hooks/useStreaming';
import { Send, StopCircle, Zap, Clock, Hash } from 'lucide-react';

interface StreamingChatProps {
  agentType: string;
  initialPrompt?: string;
  onComplete?: (result: unknown) => void;
}

export function StreamingChat({ agentType, initialPrompt, onComplete }: StreamingChatProps) {
  const [input, setInput] = useState(initialPrompt ?? '');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { stream, text, isStreaming, tokenCount, latencyMs, error, cancel } = useStreaming(agentType);

  // Auto-scroll during streaming
  useEffect(() => {
    if (scrollRef.current && isStreaming) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text, isStreaming]);

  // Notify parent on completion
  useEffect(() => {
    if (!isStreaming && text && onComplete) {
      onComplete({ text, tokenCount, latencyMs });
    }
  }, [isStreaming, text, tokenCount, latencyMs, onComplete]);

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    stream({ prompt: input.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatAgent = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-[#FFCC00]/10 flex items-center justify-center">
          <Zap className="w-4 h-4 text-[#FFCC00]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-100">
            {formatAgent(agentType)}
          </h3>
          <p className="text-xs text-zinc-500">Vercel AI SDK Streaming</p>
        </div>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-[#FFCC00]">
            <span className="w-2 h-2 rounded-full bg-[#FFCC00] animate-pulse" />
            Streaming...
          </span>
        )}
      </div>

      {/* Response area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]"
      >
        {text ? (
          <div className="neu-inset rounded-xl p-4">
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-zinc-200">
              {text}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-[#FFCC00] animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          </div>
        ) : !isStreaming && !error ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            Send a message to start streaming
          </div>
        ) : null}

        {error && (
          <div className="neu-inset rounded-xl p-4 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Stats footer (shown after completion) */}
      {!isStreaming && text && (
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {tokenCount} tokens
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {(latencyMs / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${formatAgent(agentType)}...`}
            rows={2}
            className="flex-1 neu-inset rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 bg-transparent border border-[#FFCC00]/20 focus:border-[#FFCC00]/50 focus:outline-none resize-none"
          />
          {isStreaming ? (
            <button
              onClick={cancel}
              className="neu-raised p-3 rounded-xl text-red-400 hover:text-red-300 transition-colors"
              title="Stop streaming"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="neu-raised p-3 rounded-xl text-[#FFCC00] hover:text-[#FFD700] disabled:text-zinc-600 transition-colors"
              title="Send"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
