import { useEffect, useCallback, useReducer } from 'react';
import {
  Calendar as CalendarIcon,
  List,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { fetchEconomicCalendar } from '../../../api';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  importance: 'high' | 'medium' | 'low';
  source: string;
  category?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  description?: string;
}

type ViewMode = 'month' | 'list';

const IMPORTANCE_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 ring-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 ring-amber-500/30',
  low: 'bg-zinc-500/20 text-zinc-400 ring-zinc-500/30',
};

const IMPORTANCE_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-zinc-500',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface State {
  events: CalendarEvent[];
  loading: boolean;
  viewMode: ViewMode;
  currentDate: Date;
  importanceFilter: string;
  error: string | null;
}

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; events: CalendarEvent[] }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'SET_VIEW'; value: ViewMode }
  | { type: 'SET_DATE'; date: Date }
  | { type: 'SET_FILTER'; value: string };

const INITIAL: State = {
  events: [],
  loading: true,
  viewMode: 'month',
  currentDate: new Date(),
  importanceFilter: 'all',
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, events: action.events };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SET_VIEW':
      return { ...state, viewMode: action.value };
    case 'SET_DATE':
      return { ...state, currentDate: action.date };
    case 'SET_FILTER':
      return { ...state, importanceFilter: action.value };
    default:
      return state;
  }
}

export function EconomicCalendar() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();

  const loadEvents = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const from = new Date(year, month, 1).toISOString().slice(0, 10);
      const to = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      const imp = state.importanceFilter !== 'all' ? state.importanceFilter : undefined;
      const data = await fetchEconomicCalendar(from, to, imp);
      const items = Array.isArray(data) ? data : (data as { events: CalendarEvent[] }).events || [];
      if (items.length > 0) {
        dispatch({ type: 'LOAD_SUCCESS', events: items });
      } else {
        throw new Error('empty');
      }
    } catch {
      const mm = String(month + 1).padStart(2, '0');
      const mockEvents: CalendarEvent[] = [
        { id: '1', title: 'RBA Board Meeting', date: `${year}-${mm}-04`, time: '14:30', importance: 'high', source: 'RBA', category: 'Monetary Policy' },
        { id: '2', title: 'Employment Data', date: `${year}-${mm}-13`, time: '11:30', importance: 'high', source: 'ABS', category: 'Labour', forecast: '20,000', previous: '14,200' },
        { id: '3', title: 'CPI Release', date: `${year}-${mm}-15`, time: '11:30', importance: 'high', source: 'ABS', category: 'Inflation', forecast: '3.4%', previous: '3.6%' },
        { id: '4', title: 'Retail Sales', date: `${year}-${mm}-07`, time: '11:30', importance: 'medium', source: 'ABS', category: 'Consumer' },
        { id: '5', title: 'Trade Balance', date: `${year}-${mm}-09`, time: '11:30', importance: 'medium', source: 'ABS', category: 'Trade' },
        { id: '6', title: 'Business Confidence', date: `${year}-${mm}-11`, time: '11:30', importance: 'medium', source: 'NAB', category: 'Business' },
        { id: '7', title: 'Consumer Sentiment', date: `${year}-${mm}-18`, time: '10:30', importance: 'low', source: 'Westpac', category: 'Consumer' },
        { id: '8', title: 'Building Approvals', date: `${year}-${mm}-22`, time: '11:30', importance: 'low', source: 'ABS', category: 'Housing' },
      ];
      dispatch({ type: 'LOAD_SUCCESS', events: mockEvents });
      dispatch({ type: 'LOAD_ERROR', error: 'Using sample calendar data' });
    }
  }, [year, month, state.importanceFilter, dispatch]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const prevMonth = () => dispatch({ type: 'SET_DATE', date: new Date(year, month - 1, 1) });
  const nextMonth = () => dispatch({ type: 'SET_DATE', date: new Date(year, month + 1, 1) });

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startPadding; i++) calendarDays.push(null);
  for (let i = 1; i <= totalDays; i++) calendarDays.push(i);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return state.events.filter((e) => e.date === dateStr);
  };

  const isToday = (day: number) => {
    const now = new Date();
    return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  };

  const filteredEvents =
    state.importanceFilter === 'all'
      ? state.events
      : state.events.filter((e) => e.importance === state.importanceFilter);
  const sortedEvents = [...filteredEvents].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="neu-raised-sm p-1.5 rounded-lg text-zinc-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-lg font-bold text-white min-w-[180px] text-center">
            {MONTHS[month]} {year}
          </h3>
          <button
            onClick={nextMonth}
            className="neu-raised-sm p-1.5 rounded-lg text-zinc-400 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {['all', 'high', 'medium', 'low'].map((level) => (
            <button
              key={level}
              onClick={() => dispatch({ type: 'SET_FILTER', value: level })}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                state.importanceFilter === level
                  ? 'bg-[#FFCC00]/20 text-[#FFCC00] ring-1 ring-[#FFCC00]/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}

          <div className="w-px h-6 bg-zinc-700" />

          <button
            onClick={() => dispatch({ type: 'SET_VIEW', value: 'month' })}
            className={`p-1.5 rounded-lg transition-all ${state.viewMode === 'month' ? 'text-[#FFCC00] bg-[#FFCC00]/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <CalendarIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', value: 'list' })}
            className={`p-1.5 rounded-lg transition-all ${state.viewMode === 'list' ? 'text-[#FFCC00] bg-[#FFCC00]/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {state.error && (
        <div className="text-xs text-amber-400 neu-inset px-3 py-2 rounded-lg">{state.error}</div>
      )}

      {state.loading ? (
        <div className="neu-raised rounded-2xl p-8 animate-pulse">
          <div className="h-64 bg-zinc-800/50 rounded-xl" />
        </div>
      ) : state.viewMode === 'month' ? (
        <div className="neu-raised rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-white/5">
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2.5 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              return (
                <div
                  key={`cell-${idx}`}
                  className={`min-h-[80px] sm:min-h-[100px] p-1.5 border-b border-r border-white/5 ${
                    day === null ? 'bg-white/[0.01]' : 'hover:bg-white/[0.02]'
                  } ${isToday(day ?? 0) ? 'bg-[#FFCC00]/[0.03]' : ''}`}
                >
                  {day && (
                    <>
                      <span
                        className={`text-xs font-medium ${
                          isToday(day) ? 'text-[#FFCC00] font-bold' : 'text-zinc-400'
                        }`}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map((evt) => (
                          <div
                            key={evt.id}
                            className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${IMPORTANCE_COLORS[evt.importance]}`}
                            title={evt.title}
                          >
                            {evt.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-zinc-500 pl-1">
                            +{dayEvents.length - 3} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedEvents.length === 0 ? (
            <div className="neu-raised rounded-2xl p-8 text-center text-zinc-500 text-sm">
              No events scheduled
            </div>
          ) : (
            sortedEvents.map((evt) => (
              <div
                key={evt.id}
                className="neu-raised rounded-xl p-4 flex items-start gap-4 hover:border-[#FFCC00]/10 border border-transparent transition-all"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${IMPORTANCE_DOT[evt.importance]}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-white truncate">{evt.title}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ring-1 font-medium ${IMPORTANCE_COLORS[evt.importance]}`}
                    >
                      {evt.importance}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {new Date(evt.date).toLocaleDateString('en-AU', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    {evt.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {evt.time} AEST
                      </span>
                    )}
                    <span className="text-zinc-600">{evt.source}</span>
                  </div>
                  {(evt.forecast || evt.previous) && (
                    <div className="flex gap-4 mt-2 text-xs">
                      {evt.forecast && (
                        <span className="text-zinc-400">
                          Forecast: <span className="text-white font-medium">{evt.forecast}</span>
                        </span>
                      )}
                      {evt.previous && (
                        <span className="text-zinc-400">
                          Previous: <span className="text-zinc-300">{evt.previous}</span>
                        </span>
                      )}
                      {evt.actual && (
                        <span className="text-zinc-400">
                          Actual: <span className="text-emerald-400 font-medium">{evt.actual}</span>
                        </span>
                      )}
                    </div>
                  )}
                  {evt.description && (
                    <p className="mt-1 text-xs text-zinc-500">{evt.description}</p>
                  )}
                </div>
                {evt.importance === 'high' && (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
