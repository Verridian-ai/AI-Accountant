import { useState } from 'react';
import { complianceApi } from '../../../api';
import { FileText, Copy, Check, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface ReportData {
  title: string;
  period: string;
  generatedAt: string;
  summary: {
    totalObligations: number;
    compliant: number;
    overdue: number;
    pending: number;
    complianceRate: number;
  };
  obligations: Array<{
    type: string;
    period: string;
    dueDate: string;
    status: string;
    riskLevel: string;
  }>;
  anomalySummary: {
    totalAlerts: number;
    critical: number;
    high: number;
    resolved: number;
  };
  recommendations: string[];
}

interface ComplianceReportProps {
  userId: string;
}

const ragColors: Record<string, string> = {
  compliant: 'text-emerald-400',
  lodged: 'text-blue-400',
  pending: 'text-yellow-400',
  in_progress: 'text-cba-gold',
  overdue: 'text-red-400',
};

export function ComplianceReport({ userId }: ComplianceReportProps) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [periodType, setPeriodType] = useState<'quarter' | 'year'>('quarter');
  const [includeRecommendations, setIncludeRecommendations] = useState(true);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const data = await complianceApi.report(userId, {
        periodType,
        includeRecommendations,
        financialYear: '2025-2026',
      });
      setReport(data);
    } catch (e) {
      console.error('Failed to generate report', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    const text = formatReportText(report);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="neu-raised rounded-2xl p-4">
        <h4 className="text-primary font-bold text-sm mb-4">Generate Report</h4>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="compli-f1" className="block text-secondary text-xs font-bold mb-1.5">
              Period
            </label>
            <select
              id="compli-f1"
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as 'quarter' | 'year')}
              className="neu-inset px-3 py-2 rounded-xl bg-transparent text-sm text-primary outline-none"
            >
              <option value="quarter">Current Quarter</option>
              <option value="year">Full Financial Year</option>
            </select>
          </div>

          <label htmlFor="compli-f2" className="flex items-center gap-2 cursor-pointer">
            <input
              id="compli-f2"
              type="checkbox"
              checked={includeRecommendations}
              onChange={(e) => setIncludeRecommendations(e.target.checked)}
              className="rounded accent-[#FFCC00]"
            />
            <span className="text-secondary text-sm">Include Recommendations</span>
          </label>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cba-gold text-base font-bold text-sm hover:bg-[#FFD633] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Generate
          </button>
        </div>
      </div>

      {/* Report Display */}
      {report && (
        <div className="neu-raised rounded-2xl p-6 space-y-6">
          {/* Report Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-gradient-gold">
                {report.title || 'Compliance Report'}
              </h3>
              <p className="text-muted text-sm">
                Period: {report.period} &bull; Generated:{' '}
                {new Date(report.generatedAt).toLocaleString('en-AU')}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg neu-raised-sm text-sm text-secondary hover:text-cba-gold transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="neu-inset rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{report.summary.totalObligations}</p>
              <p className="text-[10px] text-muted uppercase font-bold">Total</p>
            </div>
            <div className="neu-inset rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{report.summary.compliant}</p>
              <p className="text-[10px] text-muted uppercase font-bold">Compliant</p>
            </div>
            <div className="neu-inset rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{report.summary.overdue}</p>
              <p className="text-[10px] text-muted uppercase font-bold">Overdue</p>
            </div>
            <div className="neu-inset rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-cba-gold">
                {Math.round(report.summary.complianceRate)}%
              </p>
              <p className="text-[10px] text-muted uppercase font-bold">Rate</p>
            </div>
          </div>

          {/* Obligation Table */}
          <div>
            <h4 className="text-primary font-bold text-sm mb-3">Obligations</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-3 py-2 text-secondary font-semibold">Type</th>
                    <th className="text-left px-3 py-2 text-secondary font-semibold">Period</th>
                    <th className="text-left px-3 py-2 text-secondary font-semibold">Due</th>
                    <th className="text-left px-3 py-2 text-secondary font-semibold">Status</th>
                    <th className="text-left px-3 py-2 text-secondary font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {report.obligations.map((ob, i) => (
                    <tr key={`item-${i}`} className="border-b border-border/50">
                      <td className="px-3 py-2 text-primary">{ob.type}</td>
                      <td className="px-3 py-2 text-secondary">{ob.period}</td>
                      <td className="px-3 py-2 text-secondary">
                        {new Date(ob.dueDate).toLocaleDateString('en-AU')}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 font-bold text-xs uppercase',
                          ragColors[ob.status] ?? 'text-secondary',
                        )}
                      >
                        {ob.status.replace('_', ' ')}
                      </td>
                      <td className="px-3 py-2 text-secondary capitalize">{ob.riskLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Anomaly Summary */}
          <div>
            <h4 className="text-primary font-bold text-sm mb-3">Anomaly Summary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="neu-inset rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-primary">
                  {report.anomalySummary.totalAlerts}
                </p>
                <p className="text-[10px] text-muted uppercase font-bold">Alerts</p>
              </div>
              <div className="neu-inset rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-400">{report.anomalySummary.critical}</p>
                <p className="text-[10px] text-muted uppercase font-bold">Critical</p>
              </div>
              <div className="neu-inset rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-orange-400">{report.anomalySummary.high}</p>
                <p className="text-[10px] text-muted uppercase font-bold">High</p>
              </div>
              <div className="neu-inset rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-emerald-400">
                  {report.anomalySummary.resolved}
                </p>
                <p className="text-[10px] text-muted uppercase font-bold">Resolved</p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div>
              <h4 className="text-primary font-bold text-sm mb-3">Recommendations</h4>
              <ul className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <li key={`item-${i}`} className="flex items-start gap-2 text-sm text-secondary">
                    <span className="text-cba-gold font-bold mt-0.5">{i + 1}.</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatReportText(report: ReportData): string {
  const lines: string[] = [
    report.title || 'Compliance Report',
    `Period: ${report.period}`,
    `Generated: ${new Date(report.generatedAt).toLocaleString('en-AU')}`,
    '',
    '== Summary ==',
    `Total: ${report.summary.totalObligations} | Compliant: ${report.summary.compliant} | Overdue: ${report.summary.overdue} | Rate: ${Math.round(report.summary.complianceRate)}%`,
    '',
    '== Obligations ==',
    ...report.obligations.map(
      (o) =>
        `${o.type} | ${o.period} | Due: ${new Date(o.dueDate).toLocaleDateString('en-AU')} | ${o.status} | ${o.riskLevel}`,
    ),
    '',
    '== Anomalies ==',
    `Total: ${report.anomalySummary.totalAlerts} | Critical: ${report.anomalySummary.critical} | High: ${report.anomalySummary.high} | Resolved: ${report.anomalySummary.resolved}`,
  ];
  if (report.recommendations?.length) {
    lines.push('', '== Recommendations ==');
    report.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  }
  return lines.join('\n');
}
