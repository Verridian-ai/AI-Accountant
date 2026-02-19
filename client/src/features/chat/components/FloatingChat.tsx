import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Sparkles,
  User,
  Loader2,
  Activity,
  X,
  Minimize2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, mutationApi, type MutationEvent, type StreamEvent } from '@/api';

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content:
        'Neural link established. I can analyze your financial matrix. Ask me about spending patterns or tax efficiency.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Wave 2: Streaming & mutation state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamTokens, setStreamTokens] = useState('');
  const [pendingMutations, setPendingMutations] = useState<MutationEvent[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Wave 2: Handle streaming chat
  const handleStreamingChat = useCallback(
    async (query: string) => {
      setIsStreaming(true);
      setStreamTokens('');

      try {
        await mutationApi.fetchStreamChat(
          query,
          (event: StreamEvent) => {
            switch (event.type) {
              case 'token': {
                const data = event.data as { token?: string };
                if (data.token) {
                  setStreamTokens((prev) => prev + data.token);
                }
                break;
              }
              case 'progress': {
                const data = event.data as { description?: string };
                if (data.description) {
                  setStreamTokens(data.description);
                }
                break;
              }
              case 'complete': {
                const data = event.data as { response?: { answer?: string; sessionId?: string } };
                const answer = data.response?.answer ?? 'Response received.';
                setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
                if (data.response?.sessionId) {
                  setSessionId(data.response.sessionId);
                }
                setStreamTokens('');
                break;
              }
              case 'mutation_proposed': {
                const data = event.data as { mutation?: MutationEvent };
                if (data.mutation) {
                  setPendingMutations((prev) => [...prev, data.mutation!]);
                }
                break;
              }
              case 'error': {
                const data = event.data as { message?: string };
                setMessages((prev) => [
                  ...prev,
                  {
                    role: 'assistant',
                    content: `SYSTEM ERROR: ${data.message ?? 'Stream interrupted'}`,
                  },
                ]);
                break;
              }
            }
          },
          sessionId ?? undefined,
        );
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'SYSTEM ERROR: Streaming uplink interrupted. Falling back to standard mode.',
          },
        ]);
      } finally {
        setIsStreaming(false);
        setStreamTokens('');
      }
    },
    [sessionId],
  );

  // Wave 2: Confirm a pending mutation
  const handleConfirmMutation = useCallback(async (actionId: string) => {
    try {
      await mutationApi.confirmMutation(actionId);
      setPendingMutations((prev) => prev.filter((m) => m.id !== actionId));
    } catch (err) {
      console.error('Failed to confirm mutation:', err);
    }
  }, []);

  // Wave 2: Reject a pending mutation
  const handleRejectMutation = useCallback(async (actionId: string, reason?: string) => {
    try {
      await mutationApi.rejectMutation(actionId, reason);
      setPendingMutations((prev) => prev.filter((m) => m.id !== actionId));
    } catch (err) {
      console.error('Failed to reject mutation:', err);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      setUnreadCount(0);
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Try streaming first, fall back to legacy
      try {
        await handleStreamingChat(userMsg);
      } catch {
        // Streaming unavailable — fall back to legacy chat
        const { answer } = await api.sendChatMessage(userMsg);
        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      }

      if (!isOpen || isMinimized) {
        setUnreadCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Chat failed:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'SYSTEM ERROR: Uplink interrupted. Please retry signal transmission.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleChat = () => {
    if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(!isOpen);
    }
    setUnreadCount(0);
  };

  const minimizeChat = () => {
    setIsMinimized(true);
  };

  const closeChat = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <>
      {/* Floating Chat Button - Positioned above bottom nav on mobile */}
      <button
        type="button"
        onClick={toggleChat}
        className={cn(
          'fixed right-4 z-50 p-0 rounded-2xl transition-all duration-300 btn-press group',
          'bottom-20 md:bottom-6 md:right-6',
          isOpen && !isMinimized
            ? 'scale-0 opacity-0 pointer-events-none'
            : 'scale-100 opacity-100 drop-shadow-[0_4px_20px_rgba(255,204,0,0.3)]',
        )}
        aria-label="Open chat"
      >
        <div className="relative">
          <img src="/CEBA LOGO.png" alt="CEBA AI" className="h-36 w-36" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-primary animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
        <span className="absolute -top-12 right-0 neu-raised px-3 py-1.5 rounded-xl text-[10px] font-black text-secondary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          CEBA AI
        </span>
      </button>

      {/* Chat Popup - Full screen on mobile, floating on desktop */}
      <div
        className={cn(
          'fixed z-50 transition-all duration-300 ease-out',
          'inset-0 md:inset-auto md:bottom-6 md:right-6',
          'w-full md:w-[380px] md:max-w-[380px]',
          isOpen && !isMinimized
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-8 scale-95 pointer-events-none',
        )}
      >
        <div className="flex flex-col h-full md:h-[550px] md:max-h-[550px] neu-raised md:rounded-4xl overflow-hidden border border-border shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-border/50 flex items-center justify-between bg-white/2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="/CEBA LOGO.png"
                  alt="CEBA AI"
                  className="h-[72px] w-[72px] drop-shadow-[0_0_8px_rgba(255,204,0,0.3)]"
                />
              </div>
              <div>
                <h3 className="font-black text-zinc-100 uppercase tracking-widest text-xs">
                  CEBA AI
                </h3>
                <p className="text-[8px] text-muted uppercase tracking-[0.15em] flex items-center gap-1 font-bold">
                  <Sparkles className="h-2.5 w-2.5 text-cba-gold" /> Intelligence Engine v4
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="neu-inset px-2 py-1 rounded-full flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-black text-secondary uppercase tracking-wider">
                  Live
                </span>
              </div>
              <button
                type="button"
                onClick={minimizeChat}
                className="neu-raised-sm p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted hover:text-cba-gold transition-colors"
                aria-label="Minimize chat"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={closeChat}
                className="neu-raised-sm p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted hover:text-red-400 transition-colors"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-black/10">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-end gap-2',
                  m.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <div
                  className={cn(
                    'rounded-lg flex items-center justify-center shrink-0',
                    m.role === 'user'
                      ? 'w-7 h-7 neu-raised bg-zinc-800 text-cba-gold border border-border/50'
                      : 'w-14 h-14',
                  )}
                >
                  {m.role === 'user' ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <img
                      src="/CEBA LOGO.png"
                      alt="CEBA AI"
                      className="h-14 w-14 drop-shadow-[0_0_4px_rgba(255,204,0,0.2)]"
                    />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[90%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm relative',
                    m.role === 'user'
                      ? 'cba-gold-gradient text-base rounded-br-none font-bold shadow-lg'
                      : 'neu-raised rounded-bl-none text-primary border border-border/50',
                  )}
                >
                  <p className="leading-relaxed font-medium text-xs">{m.content}</p>
                </div>
              </div>
            ))}
            {(loading || isStreaming) && (
              <div className="flex items-end gap-2">
                <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0">
                  <img
                    src="/CEBA LOGO.png"
                    alt="CEBA AI"
                    className="h-14 w-14 animate-pulse drop-shadow-[0_0_4px_rgba(255,204,0,0.2)]"
                  />
                </div>
                <div className="neu-raised rounded-2xl rounded-bl-none px-4 py-3 border border-border/50">
                  {streamTokens ? (
                    <p className="text-xs text-primary font-medium">{streamTokens}</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cba-gold animate-bounce animate-delay-0" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cba-gold animate-bounce animate-delay-150" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cba-gold animate-bounce animate-delay-300" />
                      </div>
                      <span className="text-[8px] font-black text-muted uppercase tracking-widest">
                        Synthesizing
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Wave 2: Pending Mutations */}
            {pendingMutations.length > 0 &&
              pendingMutations.map((m) => (
                <div
                  key={m.id}
                  className="neu-raised rounded-2xl px-4 py-3 border border-cba-gold/20 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-cba-gold" />
                    <span className="text-[9px] font-black text-cba-gold uppercase tracking-widest">
                      Pending Action
                    </span>
                  </div>
                  <p className="text-xs text-primary">{m.description}</p>
                  <p className="text-[8px] text-muted">
                    {m.agentType} &rarr; {m.targetTable} ({m.mutationType})
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmMutation(m.id)}
                      className="flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-lg bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider hover:bg-emerald-500/30 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3" /> Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectMutation(m.id)}
                      className="flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-lg bg-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-wider hover:bg-red-500/30 transition-colors"
                    >
                      <XCircle className="h-3 w-3" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input - with safe area padding on mobile */}
          <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4 border-t border-border/50 bg-white/2">
            <div className="flex gap-2">
              <input
                className="flex-1 neu-inset rounded-xl px-4 py-3 text-xs focus-gold transition-all outline-none text-cba-gold placeholder-zinc-700 font-bold bg-transparent"
                placeholder="Input command query..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="cba-gold-gradient text-base w-11 h-11 flex items-center justify-center rounded-xl btn-press disabled:opacity-30 shadow-lg"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <div className="flex items-center gap-1.5">
                <Activity className="h-2.5 w-2.5 text-zinc-700" />
                <span className="text-[7px] font-black text-zinc-700 uppercase tracking-widest">
                  Latency: 12ms
                </span>
              </div>
              <span className="text-[7px] font-black text-zinc-700 uppercase tracking-widest">
                Secure Channel
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Minimized Chat Indicator */}
      {isMinimized && (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 z-50 neu-raised rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl border border-border hover:border-cba-gold/30 transition-all btn-press group"
          aria-label="Expand chat"
        >
          <div>
            <img
              src="/CEBA LOGO.png"
              alt="CEBA AI"
              className="h-16 w-16 drop-shadow-[0_0_6px_rgba(255,204,0,0.3)]"
            />
          </div>
          <div>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              CEBA AI
            </span>
            <span className="text-[8px] text-zinc-600 block uppercase tracking-wider">
              Click to expand
            </span>
          </div>
          {unreadCount > 0 && (
            <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-primary animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}
