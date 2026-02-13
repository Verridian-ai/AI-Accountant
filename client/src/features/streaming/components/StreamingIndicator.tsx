/**
 * StreamingIndicator — Compact streaming status indicator
 *
 * Embeddable in other components to show real-time stream status.
 */

import { useState, useEffect } from 'react';
import { BASE_URL } from '../../../api';
import { Check, X, Loader2 } from 'lucide-react';

const API_URL = `${BASE_URL}/api`;

interface StreamingIndicatorProps {
  sessionId: string;
  compact?: boolean;
}

type SessionStatus = 'pending' | 'streaming' | 'completed' | 'errored';

interface SessionInfo {
  status: SessionStatus;
  tokenCount?: number;
  latencyMs?: number;
}

export function StreamingIndicator({ sessionId, compact = false }: StreamingIndicatorProps) {
  const [session, setSession] = useState<SessionInfo>({ status: 'pending' });
  const [elapsed, setElapsed] = useState(0);

  // Poll session status
  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/stream/session/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setSession({
            status: data.status ?? data.session_status ?? 'pending',
            tokenCount: data.token_usage?.totalTokens,
            latencyMs: data.latency_ms,
          });
        }
      } catch {
        // Silent fail on poll
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Elapsed timer while streaming
  useEffect(() => {
    if (session.status !== 'streaming') return;
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(interval);
  }, [session.status]);

  const statusConfig: Record<
    SessionStatus,
    { color: string; label: string; icon: React.ReactNode }
  > = {
    pending: {
      color: 'text-zinc-400',
      label: 'Pending',
      icon: <span className="w-2 h-2 rounded-full bg-zinc-400" />,
    },
    streaming: {
      color: 'text-[#FFCC00]',
      label: 'Thinking...',
      icon: <Loader2 className="w-3 h-3 animate-spin text-[#FFCC00]" />,
    },
    completed: {
      color: 'text-emerald-400',
      label: 'Complete',
      icon: <Check className="w-3 h-3 text-emerald-400" />,
    },
    errored: {
      color: 'text-red-400',
      label: 'Error',
      icon: <X className="w-3 h-3 text-red-400" />,
    },
  };

  const cfg = statusConfig[session.status];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs ${cfg.color}`}>
        {cfg.icon}
        {session.status === 'streaming' && <span>{(elapsed / 1000).toFixed(1)}s</span>}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${cfg.color}`}>
      {cfg.icon}
      <span className="font-medium">{cfg.label}</span>
      {session.status === 'streaming' && (
        <span className="text-zinc-500">{(elapsed / 1000).toFixed(1)}s</span>
      )}
      {session.tokenCount != null && (
        <span className="text-zinc-500">{session.tokenCount} tokens</span>
      )}
    </div>
  );
}
