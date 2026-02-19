import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  GitCompareArrows,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  Settings2,
} from 'lucide-react';
import { reconApi, api } from '@/api';
import type { Account } from '@/api';
import { cn } from '@/lib/utils';
import { ReconMatchingWorkspace } from './ReconMatchingWorkspace';
import { ReconRulesManager } from './ReconRulesManager';

interface ReconSession {
  id: string;
  accountId: string;
  accountName?: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  statementBalanceCents?: number;
  matchedCount: number;
  unmatchedCount: number;
  differenceAmount?: number;
  createdAt: string;
  completedAt?: string;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
  in_progress: {
    label: 'In Progress',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: Activity,
  },
  completed: {
    label: 'Completed',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
};

export function ReconDashboard() {
  const [sessions, setSessions] = useState<ReconSession[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'workspace' | 'rules'>('dashboard');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Create form state
  const [formAccountId, setFormAccountId] = useState('');
  const [formPeriodStart, setFormPeriodStart] = useState('');
  const [formPeriodEnd, setFormPeriodEnd] = useState('');
  const [formStatementBalance, setFormStatementBalance] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsData, accts] = await Promise.all([
        reconApi.listSessions(),
        api.fetchAccounts(),
      ]);
      setSessions(Array.isArray(sessionsData) ? sessionsData : (sessionsData.sessions ?? []));
      setAccounts(accts);
    } catch (err) {
      console.error('Failed to load reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formAccountId || !formPeriodStart || !formPeriodEnd) return;
    setCreating(true);
    try {
      await reconApi.createSession({
        accountId: formAccountId,
        periodStart: formPeriodStart,
        periodEnd: formPeriodEnd,
        statementBalanceCents: formStatementBalance
          ? Math.round(parseFloat(formStatementBalance) * 100)
          : undefined,
      });
      await loadData();
      resetCreateForm();
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setFormAccountId('');
    setFormPeriodStart('');
    setFormPeriodEnd('');
    setFormStatementBalance('');
    setShowCreateForm(false);
  };

  const openSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setActiveView('workspace');
  };

  // Derived data
  const activeSessions = sessions.filter((s) => s.status !== 'completed');
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const totalMatched = sessions.reduce((sum, s) => sum + (s.matchedCount ?? 0), 0);
  const totalAll = sessions.reduce(
    (sum, s) => sum + (s.matchedCount ?? 0) + (s.unmatchedCount ?? 0),
    0,
  );
  const avgMatchRate = totalAll > 0 ? Math.round((totalMatched / totalAll) * 100) : 0;

  // Sub-views
  if (activeView === 'workspace' && selectedSessionId) {
    return (
      <ReconMatchingWorkspace
        sessionId={selectedSessionId}
        onBack={() => {
          setActiveView('dashboard');
          setSelectedSessionId(null);
          loadData();
        }}
      />
    );
  }

  if (activeView === 'rules') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setActiveView('dashboard')}>
            Back
          </Button>
          <h2 className="text-lg font-bold text-primary">Matching Rules</h2>
        </div>
        <ReconRulesManager />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gradient-gold flex items-center gap-2">
            <GitCompareArrows className="h-6 w-6" />
            Bank Reconciliation
          </h2>
          <p className="text-sm text-muted">Match bank transactions against your ledger</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setActiveView('rules')}>
            <Settings2 className="h-4 w-4 mr-1" />
            Rules
          </Button>
          <Button
            size="sm"
            className="bg-cba-gold text-base hover:bg-cba-gold/90"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Reconciliation
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: sessions.length.toString(), color: 'text-cba-gold' },
          { label: 'Active', value: activeSessions.length.toString(), color: 'text-amber-400' },
          { label: 'Matched Txns', value: totalMatched.toString(), color: 'text-emerald-400' },
          { label: 'Avg Match Rate', value: `${avgMatchRate}%`, color: 'text-blue-400' },
        ].map((stat) => (
          <div key={stat.label} className="neu-raised rounded-xl p-4 border border-border/50">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">
              {stat.label}
            </p>
            <p className={cn('text-2xl font-black', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Create Session Form */}
      {showCreateForm && (
        <Card className="border-cba-gold/20">
          <CardHeader>
            <CardTitle className="text-sm">New Reconciliation Session</CardTitle>
            <CardDescription>Select an account and period to begin reconciling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={formAccountId} onValueChange={setFormAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acct) => (
                      <SelectItem key={acct.id} value={acct.id}>
                        {acct.accountName} ({acct.accountNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statement Balance (AUD, optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 12345.67"
                  value={formStatementBalance}
                  onChange={(e) => setFormStatementBalance(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={formPeriodStart}
                  onChange={(e) => setFormPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={formPeriodEnd}
                  onChange={(e) => setFormPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetCreateForm}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-primary"
                onClick={handleCreate}
                disabled={creating || !formAccountId || !formPeriodStart || !formPeriodEnd}
              >
                {creating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Create Session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Sessions */}
      <section>
        <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-400" />
          Active Sessions ({activeSessions.length})
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="neu-inset rounded-xl p-6 text-center">
            <p className="text-sm text-muted">No active reconciliation sessions</p>
            <p className="text-xs text-zinc-600 mt-1">Create a new session to start reconciling</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {activeSessions.map((session) => {
              const config = statusConfig[session.status] ?? statusConfig.open;
              const StatusIcon = config.icon;
              const total = session.matchedCount + session.unmatchedCount;
              const matchPct = total > 0 ? Math.round((session.matchedCount / total) * 100) : 0;

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => openSession(session.id)}
                  className="neu-raised rounded-xl p-4 border border-border/50 hover:border-cba-gold/20 transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-primary group-hover:text-cba-gold transition-colors">
                        {session.accountName ?? `Account ${session.accountId.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted">
                        {session.periodStart} to {session.periodEnd}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px]', config.color)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">
                      {session.matchedCount} matched / {session.unmatchedCount} unmatched
                    </span>
                    <span className="font-bold text-cba-gold">{matchPct}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-cba-gold transition-all"
                      style={{ width: `${matchPct}%` }}
                    />
                  </div>
                  {session.differenceAmount !== undefined && session.differenceAmount !== 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs">
                      <AlertCircle className="h-3 w-3 text-red-400" />
                      <span className="text-red-400 font-medium">
                        Difference: {formatCurrency(session.differenceAmount)}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Completed ({completedSessions.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {completedSessions.map((session) => {
              const total = session.matchedCount + session.unmatchedCount;
              const matchPct = total > 0 ? Math.round((session.matchedCount / total) * 100) : 0;

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => openSession(session.id)}
                  className="neu-raised rounded-xl p-4 border border-border/50 hover:border-emerald-500/20 transition-all text-left opacity-80 hover:opacity-100"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-primary">
                        {session.accountName ?? `Account ${session.accountId.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted">
                        {session.periodStart} to {session.periodEnd}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Done
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{session.matchedCount} matched</span>
                    <span className="text-emerald-400 font-bold">{matchPct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
