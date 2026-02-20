import { useState, useEffect, useCallback } from 'react';
import { complianceApi } from '../../../api';
import { RefreshCw, Loader2, TrendingDown, AlertTriangle, Clock, FileX } from 'lucide-react';

interface RiskAssessment {
  overallScore: number;
  factors: {
    overdueObligations: { score: number; weight: number; details: string };
    lateHistory: { score: number; weight: number; details: string };
    anomalyCount: { score: number; weight: number; details: string };
    outstandingActions: { score: number; weight: number; details: string };
  };
  recommendations: string[];
}

interface RiskAssessmentPanelProps {
  userId: string;
}

function scoreColor(score: number): string {
  if (score <= 30) return '#4ade80'; // green
  if (score <= 60) return '#facc15'; // yellow
  if (score <= 80) return '#fb923c'; // orange
  return '#f87171'; // red
}

function scoreLabel(score: number): string {
  if (score <= 30) return 'Low Risk';
  if (score <= 60) return 'Moderate Risk';
  if (score <= 80) return 'High Risk';
  return 'Critical Risk';
}

const factorIcons: Record<string, typeof AlertTriangle> = {
  overdueObligations: FileX,
  lateHistory: Clock,
  anomalyCount: AlertTriangle,
  outstandingActions: TrendingDown,
};

const factorLabels: Record<string, string> = {
  overdueObligations: 'Overdue Obligations',
  lateHistory: 'Late History',
  anomalyCount: 'Anomalies',
  outstandingActions: 'Outstanding Actions',
};

export function RiskAssessmentPanel({ userId }: RiskAssessmentPanelProps) {
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRisk = useCallback(async () => {
    try {
      setLoading(true);
      const data = await complianceApi.risk(userId);
      setRisk(data);
    } catch (e) {
      console.error('Failed to load risk assessment', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadRisk();
  }, [loadRisk]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-cba-gold" />
      </div>
    );
  }

  const score = risk?.overallScore ?? 0;
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 70;
  const dashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-end">
        <button
          onClick={loadRisk}
          className="flex items-center gap-2 px-4 py-2 rounded-xl neu-raised-sm text-secondary hover:text-cba-gold text-sm font-bold transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gauge */}
        <div className="neu-raised rounded-2xl p-6 flex flex-col items-center justify-center">
          <svg width="180" height="180" viewBox="0 0 180 180" className="mb-4">
            {/* Background ring */}
            <circle
              cx="90"
              cy="90"
              r="70"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="12"
            />
            {/* Score ring */}
            <circle
              cx="90"
              cy="90"
              r="70"
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              transform="rotate(-90 90 90)"
              style={{ transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.5s' }}
            />
            {/* Score text */}
            <text x="90" y="82" textAnchor="middle" fill={color} fontSize="36" fontWeight="bold">
              {score}
            </text>
            <text x="90" y="105" textAnchor="middle" fill="rgb(161,161,170)" fontSize="12">
              {scoreLabel(score)}
            </text>
          </svg>
          <p className="text-muted text-xs text-center">Risk score: 0 (safest) to 100 (critical)</p>
        </div>

        {/* Factor Cards */}
        <div className="space-y-3">
          {risk?.factors &&
            Object.entries(risk.factors).map(([key, factor]) => {
              const Icon = factorIcons[key] ?? AlertTriangle;
              const factorColor = scoreColor(factor.score);
              return (
                <div key={key} className="neu-raised rounded-xl p-4 flex items-center gap-4">
                  <div className="neu-inset p-2 rounded-xl" style={{ color: factorColor }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-primary text-sm font-bold">
                        {factorLabels[key] ?? key}
                      </span>
                      <span className="text-xs text-muted font-medium">
                        Weight: {Math.round(factor.weight * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-overlay overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${factor.score}%`, backgroundColor: factorColor }}
                      />
                    </div>
                    <p className="text-muted text-[11px] mt-1">{factor.details}</p>
                  </div>
                  <span className="text-lg font-bold tabular-nums" style={{ color: factorColor }}>
                    {factor.score}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Recommendations */}
      {risk?.recommendations && risk.recommendations.length > 0 && (
        <div className="neu-raised rounded-2xl p-4">
          <h4 className="text-primary font-bold text-sm mb-3">Recommendations</h4>
          <ul className="space-y-2">
            {risk.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                <span className="text-cba-gold font-bold mt-0.5">{i + 1}.</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
