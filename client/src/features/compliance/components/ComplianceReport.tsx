import { useState } from 'react';
import { complianceApi } from '../../../api';
import { FileText, Copy, Check, Loader2, Download } from 'lucide-react';
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
  in_progress: 'text-[#FFCC00]',
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
        <h4 className="text-zinc-200 font-bold text-sm mb-4">Generate Report</h4>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-zinc-400 text-xs font-bold mb-1.5">Period</label>
            <select
              value={periodType}
              onChange={e => setPeriodType(e.target.value as 'quarter' | 'year')}
              className="neu-inset px-3 py-2 rounded-xl bg-transparent text-sm text-zinc-300 outline-none"
            >
              <option value="quarter">Current Quarter</option>
              <option value="year">Full Financial Year</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeRecommendations}
              onChange={e => setIncludeRecommendations(e.target.checked)}
              className="rounded accent-[#FFCC00]"
            />
            <span className="text-zinc-400 text-sm">Include Recommendations</span>
          </label>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm hover:bg-[#FFD633] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
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
              <h3 className="text-lg font-bold text-gradient-gold">{report.title || 'Compliance Report'}</h3>
              <p className="text-zinc-500 text-sm">
                Period: {report.period} &bull; Generated: {new Date(report.generatedAt).toLocaleString('en-AU')}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg neu-raised-sm text-sm text-zinc-400 hover:text-[#FFCC00] transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="neu-inset rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-zinc-200">{report.summary.totalObligations}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Total</p>
            </div>
            <div className="neu-inset rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{report.summary.compliant}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Compliant</p>
            </div>
            <div className="neu-inset rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{report.summary.overdue}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Overdue</p>
            </div>
            <div className="neu-inset rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-[#FFCC00]">{Math.round(report.summary.complianceRate)}%</p>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Rate</p>
            </div>
          </div>

          {/* Obligation Table */}
          <div>
            <h4 className="text-zinc-200 font-bold text-sm mb-3">Obligations</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-3 py-2 text-zinc-400 font-semibold">Type</th>
                    <th className="text-left px-3 py-2 text-zinc-400 font-semibold">Period</th>
                    <th className="text-left px-3 py-2 text-zinc-400 font-semibold">Due</th>
                    <th className="text-left px-3 py-2 text-zinc-400 font-semibold">Status</th>
                    <th className="text-left px-3 py-2 text-zinc-400 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {report.obligations.map((ob, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="px-3 py-2 text-zinc-200">{ob.type}</td>
                      <td className="px-3 py-2 text-zinc-400">{ob.period}</td>
                      <td className="px-3 py-2 text-zinc-400">{new Date(ob.dueDate).toLocaleDateString('en-AU')}</td>
                      <td className={cn("px-3 py-2 font-bold text-xs uppercase", ragColors[ob.status] ?? 'text-zinc-400')}>
                        {ob.status.replace('_', ' ')}
                      </td>
                      <td className="px-3 py-2 text-zinc-400 capitalize">{ob.riskLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Anomaly Summary */}
          <div>
            <h4 className="text-zinc-200 font-bold text-sm mb-3">Anomaly Summary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="neu-inset rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-zinc-200">{report.anomalySummary.totalAlerts}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Alerts</p>
              </div>
              <div className="neu-inset rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-400">{report.anomalySummary.critical}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Critical</p>
              </div>
              <div className="neu-inset rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-orange-400">{report.anomalySummary.high}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">High</p>
              </div>
              <div className="neu-inset rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-emerald-400">{report.anomalySummary.resolved}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Resolved</p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div>
              <h4 className="text-zinc-200 font-bold text-sm mb-3">Recommendations</h4>
              <ul className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                    <span className="text-[#FFCC00] font-bold mt-0.5">{i + 1}.</span>
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
    ...report.obligations.map(o => `${o.type} | ${o.period} | Due: ${new Date(o.dueDate).toLocaleDateString('en-AU')} | ${o.status} | ${o.riskLevel}`),
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
