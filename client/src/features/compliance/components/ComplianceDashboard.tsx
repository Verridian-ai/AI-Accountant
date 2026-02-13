import { useState, useEffect } from 'react';
import { complianceApi, anomalyApi } from '../../../api';
import { ShieldCheck, AlertTriangle, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ObligationTracker } from './ObligationTracker';
import { AnomalyAlertPanel } from './AnomalyAlertPanel';
import { RiskAssessmentPanel } from './RiskAssessmentPanel';
import { ComplianceCalendar } from './ComplianceCalendar';
import { ComplianceReport } from './ComplianceReport';

type ComplianceTab = 'obligations' | 'anomalies' | 'risk' | 'calendar' | 'reports';

interface QuickStats {
  overdue: number;
  dueSoon: number;
  compliant: number;
  totalAlerts: number;
  healthScore: number;
}

export function ComplianceDashboard() {
  const [activeTab, setActiveTab] = useState<ComplianceTab>('obligations');
  const [stats, setStats] = useState<QuickStats>({ overdue: 0, dueSoon: 0, compliant: 0, totalAlerts: 0, healthScore: 100 });
  const [loading, setLoading] = useState(true);

  const userId = 'default';

  useEffect(() => {
    loadQuickStats();
  }, []);

  const loadQuickStats = async () => {
    try {
      setLoading(true);
      const [obligationData, anomalyStats, riskData] = await Promise.allSettled([
        complianceApi.obligations(userId),
        anomalyApi.stats(userId),
        complianceApi.risk(userId),
      ]);

      const obs = obligationData.status === 'fulfilled'
        ? (obligationData.value.obligations ?? obligationData.value ?? [])
        : [];
      const aStats = anomalyStats.status === 'fulfilled' ? anomalyStats.value : { total: 0 };
      const risk = riskData.status === 'fulfilled' ? riskData.value : { overallScore: 100 };

      setStats({
        overdue: Array.isArray(obs) ? obs.filter((o: any) => o.status === 'overdue').length : 0,
        dueSoon: Array.isArray(obs) ? obs.filter((o: any) => o.status === 'pending').length : 0,
        compliant: Array.isArray(obs) ? obs.filter((o: any) => o.status === 'compliant' || o.status === 'lodged').length : 0,
        totalAlerts: aStats.total ?? aStats.open ?? 0,
        healthScore: Math.max(0, 100 - (risk.overallScore ?? 0)),
      });
    } catch (e) {
      console.error('Failed to load compliance stats', e);
    } finally {
      setLoading(false);
    }
  };

  const healthColor = stats.healthScore >= 70 ? 'text-emerald-400' : stats.healthScore >= 40 ? 'text-yellow-400' : 'text-red-400';

  const tabs: { id: ComplianceTab; label: string }[] = [
    { id: 'obligations', label: 'Obligations' },
    { id: 'anomalies', label: 'Anomaly Alerts' },
    { id: 'risk', label: 'Risk Assessment' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="neu-raised rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="neu-inset p-3 rounded-xl text-[#FFCC00]">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gradient-gold">Compliance Monitor</h2>
              <p className="text-sm text-zinc-500">Australian tax compliance & anomaly detection</p>
            </div>
          </div>

          <div className="sm:ml-auto flex items-center gap-3">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            ) : (
              <div className="flex items-center gap-2 neu-inset px-4 py-2 rounded-xl">
                <span className="text-xs text-zinc-500 font-bold">Health:</span>
                <span className={cn("text-2xl font-bold tabular-nums", healthColor)}>
                  {stats.healthScore}
                </span>
                <span className="text-xs text-zinc-500">/100</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="neu-inset rounded-xl p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-red-400 tabular-nums">{stats.overdue}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Overdue</p>
            </div>
          </div>
          <div className="neu-inset rounded-xl p-3 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-yellow-400 tabular-nums">{stats.dueSoon}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Due Soon</p>
            </div>
          </div>
          <div className="neu-inset rounded-xl p-3 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">{stats.compliant}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Compliant</p>
            </div>
          </div>
          <div className="neu-inset rounded-xl p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-orange-400 tabular-nums">{stats.totalAlerts}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Alerts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300",
              activeTab === tab.id
                ? "bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_20px_rgba(255,204,0,0.2)]"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 neu-raised-sm"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'obligations' && <ObligationTracker userId={userId} />}
        {activeTab === 'anomalies' && <AnomalyAlertPanel userId={userId} />}
        {activeTab === 'risk' && <RiskAssessmentPanel userId={userId} />}
        {activeTab === 'calendar' && <ComplianceCalendar userId={userId} />}
        {activeTab === 'reports' && <ComplianceReport userId={userId} />}
      </div>
    </div>
  );
}
