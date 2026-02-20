import { useState, useEffect, useMemo, useCallback } from 'react';
import { complianceApi } from '../../../api';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface CalendarObligation {
  id: string;
  type: string;
  dueDate: string;
  status: 'compliant' | 'pending' | 'overdue' | 'lodged' | 'in_progress';
  description?: string;
}

interface ComplianceCalendarProps {
  userId: string;
}

const statusDotColors: Record<string, string> = {
  compliant: 'bg-emerald-400',
  pending: 'bg-yellow-400',
  overdue: 'bg-red-400',
  lodged: 'bg-blue-400',
  in_progress: 'bg-cba-gold',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ComplianceCalendar({ userId }: ComplianceCalendarProps) {
  const [obligations, setObligations] = useState<CalendarObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await complianceApi.calendar(userId);
      setObligations(data.obligations ?? data ?? []);
    } catch (e) {
      console.error('Failed to load calendar', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  // Convert Sun=0 to Mon=0 format
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const obligationsByDate = useMemo(() => {
    const map: Record<string, CalendarObligation[]> = {};
    for (const ob of obligations) {
      const d = ob.dueDate.split('T')[0];
      if (!map[d]) map[d] = [];
      map[d].push(ob);
    }
    return map;
  }, [obligations]);

  const upcomingObligations = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return obligations
      .filter((o) => {
        const d = new Date(o.dueDate);
        return d >= now && d <= in30;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [obligations]);

  const selectedObligations = selectedDate ? (obligationsByDate[selectedDate] ?? []) : [];

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-cba-gold" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid */}
      <div className="lg:col-span-2 neu-raised rounded-2xl p-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl neu-raised-sm text-secondary hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-primary font-bold">
            {currentMonth.toLocaleString('en-AU', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl neu-raised-sm text-secondary hover:text-primary transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-muted uppercase py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-16" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayObs = obligationsByDate[dateStr] ?? [];
            const isSelected = selectedDate === dateStr;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={cn(
                  'h-16 rounded-xl p-1 text-left transition-all duration-200 relative',
                  isSelected ? 'ring-2 ring-[#FFCC00] bg-cba-gold/5' : 'hover:bg-overlay',
                  isToday && 'border border-cba-gold/30',
                )}
              >
                <span
                  className={cn('text-xs font-bold', isToday ? 'text-cba-gold' : 'text-secondary')}
                >
                  {day}
                </span>
                {dayObs.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {dayObs.slice(0, 3).map((ob, j) => (
                      <span
                        key={j}
                        className={cn(
                          'w-2 h-2 rounded-full',
                          statusDotColors[ob.status] ?? 'bg-zinc-400',
                        )}
                      />
                    ))}
                    {dayObs.length > 3 && (
                      <span className="text-[8px] text-muted font-bold">+{dayObs.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day Details */}
        {selectedDate && selectedObligations.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
            <h4 className="text-primary text-sm font-bold">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h4>
            {selectedObligations.map((ob) => (
              <div key={ob.id} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    statusDotColors[ob.status] ?? 'bg-zinc-400',
                  )}
                />
                <span className="text-primary font-medium">{ob.type}</span>
                <span className="text-muted text-xs capitalize">
                  ({ob.status.replace('_', ' ')})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming 30 Days Sidebar */}
      <div className="neu-raised rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <CalIcon className="h-4 w-4 text-cba-gold" />
          <h4 className="text-primary font-bold text-sm">Next 30 Days</h4>
        </div>
        {upcomingObligations.length === 0 ? (
          <p className="text-muted text-sm">No upcoming obligations</p>
        ) : (
          <div className="space-y-3">
            {upcomingObligations.map((ob) => (
              <div key={ob.id} className="flex items-start gap-2">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    statusDotColors[ob.status] ?? 'bg-zinc-400',
                  )}
                />
                <div className="min-w-0">
                  <p className="text-primary text-sm font-medium truncate">{ob.type}</p>
                  <p className="text-muted text-xs">
                    Due: {new Date(ob.dueDate).toLocaleDateString('en-AU')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
