import { useState, useEffect } from 'react';
import { complianceApi } from '../../../api';
import { CheckCircle, Clock, AlertTriangle, Filter, Plus, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface Obligation {
  id: string;
  type: string;
  period: string;
  dueDate: string;
  status: 'compliant' | 'pending' | 'overdue' | 'lodged' | 'in_progress';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

interface ObligationTrackerProps {
  userId: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  compliant: {
    label: 'Compliant',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/30',
  },
  pending: {
    label: 'Pending',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/30',
  },
  overdue: { label: 'Overdue', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30' },
  lodged: { label: 'Lodged', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30' },
  in_progress: {
    label: 'In Progress',
    color: 'text-[#FFCC00]',
    bg: 'bg-[#FFCC00]/10 border-[#FFCC00]/30',
  },
};

const riskColors: Record<string, string> = {
  low: 'text-emerald-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

export function ObligationTracker({ userId }: ObligationTrackerProps) {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadObligations();
  }, [userId]);

  const loadObligations = async () => {
    try {
      setLoading(true);
      const data = await complianceApi.obligations(userId);
      setObligations(data.obligations ?? data ?? []);
    } catch (e) {
      console.error('Failed to load obligations', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSchedule = async () => {
    try {
      setGenerating(true);
      await complianceApi.generateSchedule(userId, { financialYear: '2025-2026' });
      await loadObligations();
    } catch (e) {
      console.error('Failed to generate schedule', e);
    } finally {
      setGenerating(false);
    }
  };

  const handleLodge = async (checkId: string) => {
    try {
      await complianceApi.lodge(checkId, {
        lodgedDate: new Date().toISOString(),
        lodgedBy: userId,
      });
      await loadObligations();
    } catch (e) {
      console.error('Failed to lodge', e);
    }
  };

  const filtered =
    statusFilter === 'all' ? obligations : obligations.filter((o) => o.status === statusFilter);

  const isOverdue = (o: Obligation) =>
    o.status === 'overdue' || (o.status === 'pending' && new Date(o.dueDate) < new Date());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFCC00]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 neu-inset px-3 py-2 rounded-xl">
          <Filter className="h-4 w-4 text-zinc-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-sm text-zinc-300 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="lodged">Lodged</option>
            <option value="compliant">Compliant</option>
          </select>
        </div>

        <button
          onClick={handleGenerateSchedule}
          disabled={generating}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm hover:bg-[#FFD633] transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Generate Schedule
        </button>
      </div>

      {/* Table */}
      <div className="neu-raised rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-zinc-400 font-semibold">Type</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-semibold">Period</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-semibold">Due Date</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-semibold">Status</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-semibold">Risk</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No obligations found. Generate a schedule to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((ob) => {
                  const sc = statusConfig[ob.status] ?? statusConfig.pending;
                  return (
                    <tr
                      key={ob.id}
                      className={cn(
                        'border-b border-white/5 hover:bg-white/[0.02] transition-colors',
                        isOverdue(ob) && 'border-l-2 border-l-red-500',
                      )}
                    >
                      <td className="px-4 py-3 text-zinc-200 font-medium">{ob.type}</td>
                      <td className="px-4 py-3 text-zinc-400">{ob.period}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {new Date(ob.dueDate).toLocaleDateString('en-AU')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-lg text-xs font-bold border',
                            sc.bg,
                            sc.color,
                          )}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-xs font-bold uppercase',
                            riskColors[ob.riskLevel] ?? 'text-zinc-400',
                          )}
                        >
                          {ob.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {ob.status !== 'lodged' && ob.status !== 'compliant' && (
                            <button
                              onClick={() => handleLodge(ob.id)}
                              className="px-2 py-1 text-xs font-bold rounded-lg text-blue-400 hover:bg-blue-400/10 transition-colors"
                            >
                              Mark Lodged
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
