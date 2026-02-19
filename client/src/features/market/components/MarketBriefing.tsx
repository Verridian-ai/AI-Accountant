import { useState, useCallback } from 'react';
import { Globe, Loader2, RefreshCw, FileText } from 'lucide-react';
import { api } from '../../../api';

type Focus = 'General' | 'Rates' | 'Equities' | 'Property' | 'Business' | 'Personal Finance';
type Timeframe = 'daily' | 'weekly' | 'monthly';

interface BriefingSection {
  title: string;
  content: string;
}

interface BriefingData {
  title: string;
  generatedAt: string;
  sections: BriefingSection[];
  summary?: string;
}

const FOCUS_OPTIONS: Focus[] = [
  'General',
  'Rates',
  'Equities',
  'Property',
  'Business',
  'Personal Finance',
];
const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export function MarketBriefing() {
  const [focus, setFocus] = useState<Focus>('General');
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = `Generate a ${timeframe} Australian market briefing focused on ${focus}. Include key economic indicators, market movements, and actionable insights. Format with clear sections.`;
      const result = await api.sendChatMessage(query);

      // Parse the response into sections
      const text = result.answer || '';
      const sections: BriefingSection[] = [];

      // Try to split by markdown headers or double newlines
      const parts = text.split(/\n##?\s+/);
      if (parts.length > 1) {
        parts.forEach((part, i) => {
          if (i === 0 && part.trim()) {
            sections.push({ title: 'Overview', content: part.trim() });
          } else if (part.trim()) {
            const lines = part.split('\n');
            const title = lines[0]?.trim() || `Section ${i}`;
            const content = lines.slice(1).join('\n').trim();
            sections.push({ title, content });
          }
        });
      } else {
        // If no headers, split by paragraphs
        const paragraphs = text.split('\n\n').filter((p: string) => p.trim());
        if (paragraphs.length > 0) {
          sections.push({ title: 'Market Overview', content: paragraphs[0] });
        }
        if (paragraphs.length > 1) {
          sections.push({ title: 'Key Points', content: paragraphs.slice(1).join('\n\n') });
        }
      }

      if (sections.length === 0) {
        sections.push({ title: 'Market Briefing', content: text || 'No data available' });
      }

      setBriefing({
        title: `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} ${focus} Briefing`,
        generatedAt: new Date().toISOString(),
        sections,
        summary: sections[0]?.content?.slice(0, 200),
      });
    } catch {
      setError('Failed to generate briefing. Please try again.');
      // Set a fallback briefing
      setBriefing({
        title: `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} ${focus} Briefing`,
        generatedAt: new Date().toISOString(),
        sections: [
          {
            title: 'Market Overview',
            content:
              'The Australian market continues to navigate a complex macroeconomic environment. The RBA has maintained the cash rate as it monitors inflation trends against employment data.',
          },
          {
            title: 'Key Indicators',
            content:
              'Cash Rate: 4.35% (held steady)\nCPI: 3.6% YoY (trending down)\nUnemployment: 4.1% (slight uptick)\nASX 200: Moderate gains on global sentiment',
          },
          {
            title: 'Outlook',
            content:
              'Markets are pricing in potential rate adjustments later in the year, subject to inflation and employment data over coming quarters.',
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [focus, timeframe]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="neu-raised rounded-2xl p-4 space-y-4">
        <div>
          <label htmlFor="market-f1" className="text-xs text-muted font-medium uppercase tracking-wider mb-2 block">
            Focus Area
          </label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setFocus(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  focus === opt
                    ? 'bg-cba-gold/20 text-cba-gold ring-1 ring-[#FFCC00]/30'
                    : 'text-muted hover:text-primary hover:bg-overlay neu-raised-sm'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="market-f2" className="text-xs text-muted font-medium uppercase tracking-wider mb-2 block">
            Timeframe
          </label>
          <div className="flex gap-2">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  timeframe === tf.id
                    ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                    : 'text-muted hover:text-primary hover:bg-overlay neu-raised-sm'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generateBriefing}
          disabled={loading}
          className="w-full sm:w-auto neu-raised px-6 py-3 rounded-xl text-sm font-bold text-cba-gold hover:bg-cba-gold/10 disabled:opacity-50 transition-all flex items-center gap-2 justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Globe className="w-4 h-4" />
              Generate Briefing
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="text-xs text-amber-400 neu-inset px-3 py-2 rounded-lg">{error}</div>
      )}

      {/* Briefing Display */}
      {briefing && (
        <div className="neu-raised rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="neu-inset p-2 rounded-xl text-cba-gold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">{briefing.title}</h3>
                <p className="text-[10px] text-muted">
                  Generated {new Date(briefing.generatedAt).toLocaleString('en-AU')}
                </p>
              </div>
            </div>
            <button
              onClick={generateBriefing}
              disabled={loading}
              className="neu-raised-sm p-2 rounded-lg text-secondary hover:text-cba-gold transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {briefing.sections.map((section, idx) => (
              <div key={`item-${idx}`} className="space-y-2">
                <h4 className="text-sm font-bold text-cba-gold">{section.title}</h4>
                <div className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </div>
                {idx < briefing.sections.length - 1 && (
                  <div className="border-b border-border/50 pt-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!briefing && !loading && (
        <div className="neu-raised rounded-2xl p-12 text-center">
          <Globe className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-secondary mb-1">No Briefing Generated</h3>
          <p className="text-xs text-zinc-600">
            Select your focus area and timeframe, then click Generate Briefing
          </p>
        </div>
      )}
    </div>
  );
}
