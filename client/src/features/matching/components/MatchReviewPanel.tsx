import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, ArrowRightLeft, FileText, Loader2 } from 'lucide-react';
import { matchesApi } from '@/api';
import type { MatchCandidate } from '@/api';

interface DocumentSummary {
  id: string;
  vendorName: string;
  amount: number;
  date: string;
  status: 'pending' | 'suggested' | 'matched';
  confidence?: number;
}

function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(score * 100, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-400 font-mono w-8 text-right">
        {(score * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 0.85) return 'text-emerald-400';
  if (score >= 0.6) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 0.85) return 'bg-emerald-400';
  if (score >= 0.6) return 'bg-amber-400';
  return 'bg-red-400';
}

export function MatchReviewPanel() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Load unmatched documents (uses stats endpoint as proxy)
  useEffect(() => {
    const loadDocs = async () => {
      setLoadingDocs(true);
      try {
        const stats = await matchesApi.getStats();
        // Create placeholder entries for pending/suggested docs
        const placeholders: DocumentSummary[] = [];
        for (let i = 0; i < Math.min(stats.pending, 50); i++) {
          placeholders.push({
            id: `pending-${i}`,
            vendorName: stats.topVendors[i % stats.topVendors.length]?.name ?? 'Unknown',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            status: 'pending',
          });
        }
        setDocuments(placeholders);
      } catch (e) {
        console.error('Failed to load documents', e);
      } finally {
        setLoadingDocs(false);
      }
    };
    loadDocs();
  }, []);

  const loadCandidates = useCallback(async (docId: string) => {
    setLoadingCandidates(true);
    setCandidates([]);
    try {
      const data = await matchesApi.findCandidates(docId);
      setCandidates(data);
    } catch (e) {
      console.error('Failed to load candidates', e);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    loadCandidates(docId);
  };

  const handleConfirm = async (candidate: MatchCandidate) => {
    if (!selectedDocId) return;
    try {
      const result = await matchesApi.scoreMatch(selectedDocId, candidate.transactionId);
      if (result?.matchId) {
        await matchesApi.confirm(result.matchId);
      }
      // Remove from documents list
      setDocuments((prev) => prev.filter((d) => d.id !== selectedDocId));
      setCandidates([]);
      setSelectedDocId(null);
    } catch (e) {
      console.error('Failed to confirm match', e);
    }
  };

  const handleReject = async (candidate: MatchCandidate) => {
    if (!selectedDocId) return;
    try {
      const result = await matchesApi.scoreMatch(selectedDocId, candidate.transactionId);
      if (result?.matchId) {
        await matchesApi.reject(result.matchId);
      }
      setCandidates((prev) => prev.filter((c) => c.transactionId !== candidate.transactionId));
    } catch (e) {
      console.error('Failed to reject match', e);
    }
  };

  const handleBatchConfirmHigh = async () => {
    const highConfidence = candidates.filter((c) => c.score.overallScore >= 0.85);
    for (const c of highConfidence) {
      await handleConfirm(c);
    }
  };

  const handleBatchRejectLow = async () => {
    const lowConfidence = candidates.filter((c) => c.score.overallScore < 0.4);
    for (const c of lowConfidence) {
      await handleReject(c);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
      {/* Left Panel: Document List */}
      <div className="lg:col-span-1 neu-raised rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-zinc-200">Documents</h3>
          <p className="text-[10px] text-zinc-500">{documents.length} pending review</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {loadingDocs ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 text-zinc-500 animate-spin mx-auto" />
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400/50 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">All documents matched</p>
            </div>
          ) : (
            documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleSelectDoc(doc.id)}
                className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                  selectedDocId === doc.id
                    ? 'bg-[#FFCC00]/5 border-l-2 border-[#FFCC00]'
                    : 'border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{doc.vendorName}</p>
                    <p className="text-xs text-zinc-500">{doc.date}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {doc.amount !== 0 && (
                      <p className="text-sm font-mono text-zinc-300">
                        ${Math.abs(doc.amount).toFixed(2)}
                      </p>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        doc.status === 'suggested'
                          ? 'text-amber-400'
                          : doc.status === 'matched'
                            ? 'text-emerald-400'
                            : 'text-zinc-500'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Match Candidates */}
      <div className="lg:col-span-2 neu-raised rounded-xl overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Match Candidates</h3>
            {selectedDocId && (
              <p className="text-[10px] text-zinc-500">
                {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
          {candidates.length > 0 && (
            <div className="flex items-center gap-2">
              {candidates.some((c) => c.score.overallScore >= 0.85) && (
                <button
                  onClick={handleBatchConfirmHigh}
                  className="px-3 py-1.5 rounded-lg bg-emerald-400/10 text-emerald-400 text-[10px] font-bold hover:bg-emerald-400/20 transition-colors"
                >
                  Confirm High (&gt;85%)
                </button>
              )}
              {candidates.some((c) => c.score.overallScore < 0.4) && (
                <button
                  onClick={handleBatchRejectLow}
                  className="px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 text-[10px] font-bold hover:bg-red-400/20 transition-colors"
                >
                  Reject Low (&lt;40%)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!selectedDocId ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <ArrowRightLeft className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Select a document to view candidates</p>
              </div>
            </div>
          ) : loadingCandidates ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-[#FFCC00] animate-spin" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">No matching candidates found</p>
                <p className="text-xs text-zinc-500 mt-1">Try adjusting tolerance settings</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {candidates
                .sort((a, b) => b.score.overallScore - a.score.overallScore)
                .map((candidate, idx) => {
                  const isTop = idx === 0 && candidate.score.overallScore >= 0.6;
                  return (
                    <div
                      key={candidate.transactionId}
                      className={`neu-inset rounded-xl p-4 ${isTop ? 'ring-1 ring-[#FFCC00]/30' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {isTop && (
                              <span className="text-[10px] font-bold text-[#FFCC00] uppercase">
                                Best Match
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-200 truncate">
                            {candidate.transactionDescription}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                            <span>{candidate.transactionDate}</span>
                            <span className="font-mono">
                              ${Math.abs(candidate.transactionAmount).toFixed(2)}
                            </span>
                          </div>

                          {/* Score Details */}
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`text-lg font-bold ${getScoreColor(candidate.score.overallScore)}`}
                              >
                                {(candidate.score.overallScore * 100).toFixed(0)}%
                              </span>
                              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${getScoreBarColor(candidate.score.overallScore)} transition-all duration-300`}
                                  style={{ width: `${candidate.score.overallScore * 100}%` }}
                                />
                              </div>
                            </div>
                            <ScoreBar
                              score={candidate.score.factors.amount}
                              label="Amount 40%"
                              color="bg-blue-400"
                            />
                            <ScoreBar
                              score={candidate.score.factors.date}
                              label="Date 25%"
                              color="bg-purple-400"
                            />
                            <ScoreBar
                              score={candidate.score.factors.vendor}
                              label="Vendor 20%"
                              color="bg-emerald-400"
                            />
                            <ScoreBar
                              score={candidate.score.factors.rule}
                              label="Rule 15%"
                              color="bg-amber-400"
                            />
                          </div>

                          {/* Differences */}
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-zinc-500">
                              Amount diff:{' '}
                              <span
                                className={`font-mono ${candidate.score.amountDifference === 0 ? 'text-emerald-400' : 'text-amber-400'}`}
                              >
                                {candidate.score.amountDifference >= 0 ? '+' : '-'}$
                                {Math.abs(candidate.score.amountDifference).toFixed(2)}
                              </span>
                            </span>
                            <span className="text-zinc-500">
                              Date diff:{' '}
                              <span className="font-mono text-zinc-300">
                                {candidate.score.dateDifference} days
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => handleConfirm(candidate)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-400/10 text-emerald-400 text-xs font-medium hover:bg-emerald-400/20 transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirm
                          </button>
                          <button
                            onClick={() => handleReject(candidate)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-400/10 text-red-400 text-xs font-medium hover:bg-red-400/20 transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
