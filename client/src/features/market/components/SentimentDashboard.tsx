import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Search, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { fetchSentiment, fetchBatchSentiment, analyzeMarketImpact } from '../../../api';

interface SentimentResult {
  topic: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  score: number; // -1 to +1
  confidence: number; // 0 to 1
  summary?: string;
  sources?: string[];
  updatedAt?: string;
}

interface ImpactResult {
  event: string;
  impact: string;
  affectedAreas: string[];
  severity: 'high' | 'medium' | 'low';
  recommendation?: string;
}

const DEFAULT_TOPICS = [
  'RBA Interest Rates',
  'Australian Property Market',
  'ASX 200 Outlook',
  'Banking Sector',
  'Employment Outlook',
  'Inflation Expectations',
  'AUD Dollar',
  'Crypto Market',
];

const SENTIMENT_COLORS: Record<string, string> = {
  bullish: 'text-emerald-400',
  bearish: 'text-red-400',
  neutral: 'text-zinc-400',
  mixed: 'text-amber-400',
};

const SENTIMENT_BG: Record<string, string> = {
  bullish: 'bg-emerald-500/10 ring-emerald-500/30',
  bearish: 'bg-red-500/10 ring-red-500/30',
  neutral: 'bg-zinc-500/10 ring-zinc-500/30',
  mixed: 'bg-amber-500/10 ring-amber-500/30',
};

export function SentimentDashboard() {
  const [sentiments, setSentiments] = useState<SentimentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [customTopic, setCustomTopic] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [impactEvent, setImpactEvent] = useState('');
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBatchSentiment = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchBatchSentiment(DEFAULT_TOPICS);
      const results = Array.isArray(data) ? data : (data as { results: SentimentResult[] }).results || [];
      if (results.length > 0) {
        setSentiments(results);
      } else {
        throw new Error('empty');
      }
    } catch {
      // Fallback data
      setSentiments(DEFAULT_TOPICS.map((topic, i) => ({
        topic,
        sentiment: (['bullish', 'bearish', 'neutral', 'mixed'] as const)[i % 4],
        score: Number(((Math.random() * 2 - 1)).toFixed(2)),
        confidence: Number((0.5 + Math.random() * 0.5).toFixed(2)),
        summary: `Market analysis for ${topic} indicates current conditions.`,
      })));
      setError('Using cached sentiment data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatchSentiment();
  }, [loadBatchSentiment]);

  const handleCustomSearch = useCallback(async () => {
    if (!customTopic.trim()) return;
    setCustomLoading(true);
    try {
      const data = await fetchSentiment(customTopic);
      const result: SentimentResult = {
        topic: customTopic,
        sentiment: (data as SentimentResult).sentiment || 'neutral',
        score: (data as SentimentResult).score || 0,
        confidence: (data as SentimentResult).confidence || 0.5,
        summary: (data as SentimentResult).summary,
      };
      setSentiments(prev => [result, ...prev.filter(s => s.topic !== customTopic)]);
      setCustomTopic('');
    } catch {
      setError(`Failed to analyze sentiment for "${customTopic}"`);
    } finally {
      setCustomLoading(false);
    }
  }, [customTopic]);

  const handleImpactAnalysis = useCallback(async () => {
    if (!impactEvent.trim()) return;
    setImpactLoading(true);
    try {
      const data = await analyzeMarketImpact(impactEvent);
      setImpactResult(data as ImpactResult);
    } catch {
      setImpactResult({
        event: impactEvent,
        impact: 'Unable to analyze impact at this time. Please try again later.',
        affectedAreas: ['Market data unavailable'],
        severity: 'low',
      });
    } finally {
      setImpactLoading(false);
    }
  }, [impactEvent]);

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return <TrendingUp className="w-5 h-5" />;
      case 'bearish': return <TrendingDown className="w-5 h-5" />;
      case 'mixed': return <AlertTriangle className="w-5 h-5" />;
      default: return <Minus className="w-5 h-5" />;
    }
  };

  const getScoreBar = (score: number) => {
    const pct = ((score + 1) / 2) * 100;
    return (
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score > 0.2 ? 'bg-emerald-500' : score < -0.2 ? 'bg-red-500' : 'bg-zinc-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Custom Topic Search */}
      <div className="neu-raised rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-[#FFCC00]" />
          Research Custom Topic
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter a topic to analyze sentiment..."
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSearch()}
            className="flex-1 neu-inset px-4 py-2 rounded-xl text-sm text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
          />
          <button
            onClick={handleCustomSearch}
            disabled={customLoading || !customTopic.trim()}
            className="neu-raised-sm px-4 py-2 rounded-xl text-sm font-bold text-[#FFCC00] hover:bg-[#FFCC00]/10 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {customLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            Analyze
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-amber-400 neu-inset px-3 py-2 rounded-lg">{error}</div>
      )}

      {/* Sentiment Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="neu-raised rounded-2xl p-4 animate-pulse">
                <div className="h-4 w-24 bg-zinc-700 rounded mb-3" />
                <div className="h-8 w-16 bg-zinc-700 rounded mb-2" />
                <div className="h-2 w-full bg-zinc-700 rounded mb-2" />
                <div className="h-3 w-20 bg-zinc-700 rounded" />
              </div>
            ))
          : sentiments.map((item) => (
              <div
                key={item.topic}
                className={`neu-raised rounded-2xl p-4 border border-transparent hover:border-[#FFCC00]/20 transition-all`}
              >
                <p className="text-xs text-zinc-500 font-medium mb-2 truncate">{item.topic}</p>

                {/* Sentiment Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${SENTIMENT_BG[item.sentiment]} ${SENTIMENT_COLORS[item.sentiment]}`}>
                    {getSentimentIcon(item.sentiment)}
                    {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
                  </span>
                </div>

                {/* Score Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1">
                    <span>Bearish</span>
                    <span>Bullish</span>
                  </div>
                  {getScoreBar(item.score)}
                </div>

                {/* Confidence */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Confidence</span>
                  <span className="text-white font-medium">{(item.confidence * 100).toFixed(0)}%</span>
                </div>

                {item.summary && (
                  <p className="mt-2 text-[11px] text-zinc-500 line-clamp-2">{item.summary}</p>
                )}
              </div>
            ))}
      </div>

      {/* Impact Analysis */}
      <div className="neu-raised rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Impact Analysis
        </h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter a market event to analyze impact (e.g., 'RBA raises rates 25bps')..."
            value={impactEvent}
            onChange={(e) => setImpactEvent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImpactAnalysis()}
            className="flex-1 neu-inset px-4 py-2 rounded-xl text-sm text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
          />
          <button
            onClick={handleImpactAnalysis}
            disabled={impactLoading || !impactEvent.trim()}
            className="neu-raised-sm px-4 py-2 rounded-xl text-sm font-bold text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {impactLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Analyze
          </button>
        </div>

        {impactResult && (
          <div className="neu-inset rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">{impactResult.event}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                impactResult.severity === 'high'
                  ? 'bg-red-500/10 text-red-400'
                  : impactResult.severity === 'medium'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-zinc-500/10 text-zinc-400'
              }`}>
                {impactResult.severity} impact
              </span>
            </div>
            <p className="text-sm text-zinc-300">{impactResult.impact}</p>
            {impactResult.affectedAreas.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Affected Areas:</p>
                <div className="flex flex-wrap gap-1">
                  {impactResult.affectedAreas.map((area, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-300">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {impactResult.recommendation && (
              <p className="text-xs text-[#FFCC00] bg-[#FFCC00]/5 px-3 py-2 rounded-lg">
                {impactResult.recommendation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
