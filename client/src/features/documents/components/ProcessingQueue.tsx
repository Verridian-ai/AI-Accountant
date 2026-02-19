import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Loader2, CheckCircle, XCircle, RefreshCw, Play, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { documentsApi } from '@/api';
import type { OCRDocument } from '@/api';

function statusIcon(status: string) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-secondary" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    case 'extracted':
    case 'verified':
    case 'matched':
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-400" />;
    default:
      return <Clock className="h-4 w-4 text-muted" />;
  }
}

function statusBadgeEl(status: string) {
  switch (status) {
    case 'extracted':
    case 'verified':
      return <Badge variant="success">{status}</Badge>;
    case 'processing':
      return (
        <Badge variant="warning" className="animate-pulse">
          {status}
        </Badge>
      );
    case 'failed':
      return <Badge variant="destructive">{status}</Badge>;
    case 'matched':
      return <Badge>{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function ProcessingQueue() {
  const [documents, setDocuments] = useState<OCRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const [pending, processing] = await Promise.all([
        documentsApi.list('pending'),
        documentsApi.list('processing'),
      ]);
      const all = [
        ...(Array.isArray(pending) ? pending : []),
        ...(Array.isArray(processing) ? processing : []),
      ];
      setDocuments(all);
    } catch (err) {
      console.error('Failed to load queue', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    intervalRef.current = setInterval(loadQueue, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadQueue]);

  const handleProcess = async (id: string) => {
    try {
      await documentsApi.process(id);
      loadQueue();
    } catch (err) {
      console.error('Failed to process document', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await documentsApi.delete(id);
      loadQueue();
    } catch (err) {
      console.error('Failed to delete document', err);
    }
  };

  const handleProcessAll = async () => {
    const pendingIds = documents.filter((d) => d.status === 'pending').map((d) => d.id);
    if (pendingIds.length === 0) return;
    try {
      await documentsApi.batchProcess(pendingIds);
      loadQueue();
    } catch (err) {
      console.error('Failed to batch process', err);
    }
  };

  const handleRetryFailed = async () => {
    // Fetch failed docs first
    try {
      const failed = await documentsApi.list('failed');
      const failedArr = Array.isArray(failed) ? failed : [];
      if (failedArr.length === 0) return;
      await documentsApi.batchProcess(failedArr.map((d) => d.id));
      loadQueue();
    } catch (err) {
      console.error('Failed to retry', err);
    }
  };

  const pendingCount = documents.filter((d) => d.status === 'pending').length;
  const processingCount = documents.filter((d) => d.status === 'processing').length;

  if (loading) {
    return (
      <div className="neu-raised rounded-xl p-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-cba-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Queue Stats */}
      <div className="neu-raised rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-secondary" />
          <span className="text-sm text-primary">{pendingCount} queued</span>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-blue-400" />
          <span className="text-sm text-primary">{processingCount} processing</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleProcessAll}
            disabled={pendingCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cba-gold text-base text-xs font-bold hover:bg-cba-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-3 w-3" />
            Process All Pending
          </button>
          <button
            onClick={handleRetryFailed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-overlay text-primary text-xs font-bold hover:bg-overlay-hover transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry Failed
          </button>
        </div>
      </div>

      {/* Queue Table */}
      {documents.length === 0 ? (
        <div className="neu-raised rounded-xl p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-secondary font-medium">Queue is empty</p>
          <p className="text-zinc-600 text-sm mt-1">All documents have been processed</p>
        </div>
      ) : (
        <div className="neu-raised rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className="text-left py-3 px-4 text-xs font-bold text-muted uppercase tracking-wide">
                  Document
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-muted uppercase tracking-wide w-28">
                  Type
                </th>
                <th className="text-center py-3 px-4 text-xs font-bold text-muted uppercase tracking-wide w-28">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-muted uppercase tracking-wide w-36">
                  Created
                </th>
                <th className="text-right py-3 px-4 text-xs font-bold text-muted uppercase tracking-wide w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {statusIcon(doc.status)}
                      <span className="text-primary font-medium truncate max-w-[200px]">
                        {doc.fileName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-secondary capitalize">
                    {doc.documentType || 'Unknown'}
                  </td>
                  <td className="py-3 px-4 text-center">{statusBadgeEl(doc.status)}</td>
                  <td className="py-3 px-4 text-muted text-xs">
                    {new Date(doc.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 justify-end">
                      {doc.status === 'pending' && (
                        <button
                          onClick={() => handleProcess(doc.id)}
                          className="p-1.5 rounded-md hover:bg-overlay-hover text-secondary hover:text-cba-gold transition-colors"
                          title="Process now"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )}
                      {doc.status === 'pending' && (
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-secondary hover:text-red-400 transition-colors"
                          title="Cancel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
        <RefreshCw className="h-3 w-3" />
        <span>Auto-refreshing every 5 seconds</span>
      </div>
    </div>
  );
}
