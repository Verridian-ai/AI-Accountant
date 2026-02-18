import { useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { UploadZone } from '../UploadZone/index.js';
import { FileUpload } from '../FileUpload.js';
import { useStatements } from './hooks/useStatements.js';
import { useUploadQueue } from './hooks/useUploadQueue.js';
import { LoadingSkeleton } from './components/LoadingSkeleton.js';
import { StatementListHeader } from './components/StatementListHeader.js';
import { UploadQueuePanel } from './components/UploadQueuePanel.js';
import { GapAnalysisPanel } from './components/GapAnalysisPanel.js';
import { StatementCard } from './components/StatementCard.js';

export function StatementList() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useStatements();

  const {
    uploadQueue,
    batchJobId,
    progressBarRef,
    isUploading,
    queueStats,
    addFilesToQueue,
    cancelBatch,
    clearCompletedFromQueue,
  } = useUploadQueue({ refreshStatements });

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    addFilesToQueue(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Refresh polling: immediate on mount, then every 5s when not uploading
  useEffect(() => {
    refreshStatements();
    if (isUploading) return;
    const interval = setInterval(refreshStatements, 5000);
    return () => clearInterval(interval);
  }, [refreshStatements, isUploading]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="neu-raised rounded-[2.5rem] overflow-hidden flex flex-col h-full max-h-[550px] border border-white/5 shadow-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      <StatementListHeader
        statementsCount={statements.length}
        isUploading={isUploading}
        completeCount={queueStats.complete}
        totalCount={queueStats.total}
        fileInputRef={fileInputRef}
        onUploadChange={handleUpload}
      />

      {uploadQueue.length > 0 && (
        <UploadQueuePanel
          uploadQueue={uploadQueue}
          queueStats={queueStats}
          isUploading={isUploading}
          batchJobId={batchJobId}
          progressBarRef={progressBarRef}
          onCancel={cancelBatch}
          onClear={clearCompletedFromQueue}
        />
      )}

      {gapAnalysis?.coverage.hasIssues && (
        <GapAnalysisPanel
          gapAnalysis={gapAnalysis}
          showGapDetails={showGapDetails}
          onToggle={() => setShowGapDetails(!showGapDetails)}
        />
      )}

      <UploadZone
        onFilesSelected={addFilesToQueue}
        className="flex-1 overflow-y-auto p-6 space-y-4 transition-colors relative scrollbar-thin"
      >
        {statements.length === 0 && uploadQueue.length === 0 ? (
          <FileUpload onFilesSelected={addFilesToQueue} />
        ) : (
          <div className="space-y-4">
            {statements.map((stmt) => (
              <StatementCard
                key={stmt.id}
                stmt={stmt}
                expandedErrorId={expandedErrorId}
                onToggleError={setExpandedErrorId}
                retryingIds={retryingIds}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}
      </UploadZone>

      <div className="p-4 border-t border-white/5 sticky bottom-0 text-center bg-black/40 backdrop-blur-md">
        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.3em]">
          System <span className="text-[#FFCC00]">Vault</span> • Automated Node Verification
        </p>
      </div>
    </div>
  );
}
