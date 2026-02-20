import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Receipt,
  Calculator,
  Network,
  Clock,
} from 'lucide-react';
import { intelligenceApi } from '../../../api';
import { cn } from '../../../lib/utils';

interface IntelligenceTimelineProps {
  userId: string;
}

interface TimelineEvent {
  id: string;
  module: string;
  eventType: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const moduleConfig: Record<string, { icon: typeof Clock; color: string; bg: string }> = {
  transactions: { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  forecasting: { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  compliance: { icon: ShieldCheck, color: 'text-red-400', bg: 'bg-red-500/10' },
  tax: { icon: Receipt, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  bas: { icon: Calculator, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  knowledge: { icon: Network, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
};

type Granularity = 'day' | 'week' | 'month';

interface FetchState {
  events: TimelineEvent[];
  loading: boolean;
  error: string | null;
}

export function IntelligenceTimeline({ userId }: IntelligenceTimelineProps) {
  const [fetchState, setFetchState] = useState<FetchState>({
    events: [],
    loading: true,
    error: null,
  });
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeModules, setActiveModules] = useState<Set<string>>(
    new Set(Object.keys(moduleConfig)),
  );

  const loadTimeline = useCallback(async () => {
    try {
      setFetchState((prev) => ({ ...prev, loading: true, error: null }));
      const params: Record<string, string> = { granularity };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const data = await intelligenceApi.getTimeline(userId, params);
      setFetchState({
        events: Array.isArray(data) ? data : (data.events ?? []),
        loading: false,
        error: null,
      });
    } catch {
      setFetchState((prev) => ({ ...prev, loading: false, error: 'Failed to load timeline' }));
    }
  }, [userId, granularity, startDate, endDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTimeline();
  }, [loadTimeline]);

  const toggleModule = (mod: string) => {
    setActiveModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  const { events, loading, error } = fetchState;
  const filteredEvents = events.filter((e) => activeModules.has(e.module));

  // Group events by date
  const grouped = filteredEvents.reduce<Record<string, TimelineEvent[]>>((acc, evt) => {
    const dateKey = evt.timestamp.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(evt);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="neu-raised p-4 rounded-lg space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="timeline-start" className="text-xs text-muted font-medium">
              From:
            </label>
            <input
              id="timeline-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="timeline-end" className="text-xs text-muted font-medium">
              To:
            </label>
            <input
              id="timeline-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-primary"
            />
          </div>
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {(['day', 'week', 'month'] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={cn(
                  'px-3 py-1.5 text-xs font-bold uppercase transition-colors',
                  granularity === g
                    ? 'bg-cba-gold text-base'
                    : 'bg-zinc-800 text-secondary hover:text-primary',
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Module filters */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(moduleConfig).map(([mod, cfg]) => (
            <button
              key={mod}
              onClick={() => toggleModule(mod)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all',
                activeModules.has(mod)
                  ? `${cfg.bg} ${cfg.color} border-current`
                  : 'bg-zinc-800/50 text-zinc-600 border-zinc-700',
              )}
            >
              <cfg.icon className="w-3 h-3" />
              {mod}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-cba-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="neu-raised p-4 rounded-lg text-red-400 text-center">{error}</div>
      ) : sortedDates.length === 0 ? (
        <div className="neu-raised p-8 rounded-lg text-center text-muted">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No timeline events found for this period.</p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-700" />

          {sortedDates.map((date) => (
            <div key={date} className="mb-6">
              {/* Date marker */}
              <div className="flex items-center gap-3 mb-3 relative">
                <div className="absolute left-[-12px] w-6 h-6 rounded-full bg-cba-gold flex items-center justify-center">
                  <Clock className="w-3 h-3 text-base" />
                </div>
                <h3 className="text-sm font-bold text-cba-gold ml-4">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </h3>
              </div>

              {/* Events for this date */}
              <div className="space-y-2 ml-4">
                {grouped[date].map((evt) => {
                  const cfg = moduleConfig[evt.module] || {
                    icon: Clock,
                    color: 'text-secondary',
                    bg: 'bg-zinc-500/10',
                  };
                  const ModIcon = cfg.icon;
                  return (
                    <div key={evt.id} className="neu-raised p-3 rounded-lg flex items-start gap-3">
                      <div className={cn('p-1.5 rounded-lg shrink-0', cfg.bg)}>
                        <ModIcon className={cn('w-4 h-4', cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-primary">{evt.title}</span>
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                              cfg.bg,
                              cfg.color,
                            )}
                          >
                            {evt.module}
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">{evt.description}</p>
                        <span className="text-[10px] text-zinc-600 mt-1 block">
                          {new Date(evt.timestamp).toLocaleTimeString('en-AU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
