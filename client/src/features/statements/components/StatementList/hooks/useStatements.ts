import { useState, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { api } from '@/api';
import type { Statement, StatementGapAnalysis } from '@/api';

export function useStatements() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<StatementGapAnalysis | null>(null);
  const [showGapDetails, setShowGapDetails] = useState(false);

  const refreshStatements = useCallback(async () => {
    try {
      const [statementsData, gapData] = await Promise.all([
        api.fetchStatements(),
        api.fetchStatementGapAnalysis().catch(() => null),
      ]);
      setStatements(statementsData);
      setGapAnalysis(gapData);
    } catch (e) {
      console.error('Failed to fetch statements', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetry = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    try {
      setRetryingIds((prev) => new Set(prev).add(id));
      await api.reprocessStatement(id);
      await refreshStatements();
    } catch (err) {
      console.error('Retry failed', err);
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return {
    statements,
    loading,
    retryingIds,
    expandedErrorId,
    setExpandedErrorId,
    gapAnalysis,
    showGapDetails,
    setShowGapDetails,
    refreshStatements,
    handleRetry,
  };
}
