import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  FileUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  FileScan,
  Eye,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { documentsApi } from '@/api';
import type { OCRDocument } from '@/api';
import { DocumentUpload } from './DocumentUpload';
import { DocumentViewer } from './DocumentViewer';
import { ProcessingQueue } from './ProcessingQueue';

type SubTab = 'all' | 'upload' | 'queue';

const STATUS_FILTERS = [
  '',
  'pending',
  'processing',
  'extracted',
  'verified',
  'matched',
  'failed',
] as const;
const DOC_TYPE_FILTERS = ['', 'invoice', 'receipt', 'bill', 'credit_note', 'statement'] as const;

function statusBadge(status: string) {
  switch (status) {
    case 'extracted':
    case 'verified':
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
          {status}
        </span>
      );
    case 'processing':
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400 animate-pulse">
          {status}
        </span>
      );
    case 'pending':
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-zinc-500/20 text-zinc-400">
          {status}
        </span>
      );
    case 'matched':
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-[#FFCC00]/20 text-[#FFCC00]">
          {status}
        </span>
      );
    case 'failed':
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">{status}</span>
      );
    default:
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-zinc-500/20 text-zinc-400">
          {status}
        </span>
      );
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(amount: number | undefined | null) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
    amount / 100,
  );
}

export function DocumentsDashboard() {
  const [documents, setDocuments] = useState<OCRDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await documentsApi.list(statusFilter || undefined, docTypeFilter || undefined);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load documents', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, docTypeFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDelete = async (id: string) => {
    try {
      await documentsApi.delete(id);
      loadDocuments();
    } catch (err) {
      console.error('Failed to delete document', err);
    }
  };

  if (selectedDocId) {
    return (
      <DocumentViewer
        documentId={selectedDocId}
        onBack={() => {
          setSelectedDocId(null);
          loadDocuments();
        }}
      />
    );
  }

  const totalDocs = documents.length;
  const pendingCount = documents.filter((d) => d.status === 'pending').length;
  const extractedCount = documents.filter(
    (d) => d.status === 'extracted' || d.status === 'verified',
  ).length;
  const matchedCount = documents.filter((d) => d.status === 'matched').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="neu-inset p-2 rounded-xl text-rose-400">
            <FileScan className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gradient-gold">Documents</h1>
            <p className="text-sm text-zinc-500">OCR processing, invoices & receipts</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: totalDocs, icon: FileText, color: 'text-zinc-300' },
          { label: 'Pending OCR', value: pendingCount, icon: Clock, color: 'text-amber-400' },
          { label: 'Extracted', value: extractedCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Matched', value: matchedCount, icon: CheckCircle, color: 'text-[#FFCC00]' },
        ].map((stat) => (
          <div key={stat.label} className="neu-raised rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-xs text-zinc-500 uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {[
          { id: 'all' as SubTab, label: 'All Documents', icon: FileText },
          { id: 'upload' as SubTab, label: 'Upload', icon: FileUp },
          { id: 'queue' as SubTab, label: 'Queue', icon: Clock },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              subTab === tab.id
                ? 'bg-[#FFCC00] text-[#0a0a0f]'
                : 'neu-raised text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'upload' && <DocumentUpload onUploadComplete={loadDocuments} />}

      {subTab === 'queue' && <ProcessingQueue />}

      {subTab === 'all' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="neu-raised rounded-xl p-4 flex flex-wrap gap-3 items-center">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Status:</span>
            <div className="flex gap-1 flex-wrap">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    statusFilter === s
                      ? 'bg-[#FFCC00] text-[#0a0a0f]'
                      : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                  }`}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-4">
              Type:
            </span>
            <div className="flex gap-1 flex-wrap">
              {DOC_TYPE_FILTERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setDocTypeFilter(t)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    docTypeFilter === t
                      ? 'bg-[#FFCC00] text-[#0a0a0f]'
                      : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                  }`}
                >
                  {t || 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Document List */}
          {loading ? (
            <div className="neu-raised rounded-xl p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-[#FFCC00] animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="neu-raised rounded-xl p-12 text-center">
              <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 font-medium">No documents found</p>
              <p className="text-zinc-600 text-sm mt-1">
                Upload invoices, receipts, or bills to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="neu-raised rounded-xl p-4 hover:border-[#FFCC00]/20 border border-transparent transition-colors cursor-pointer"
                  onClick={() => setSelectedDocId(doc.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="neu-inset p-2 rounded-lg shrink-0">
                        <FileText className="h-5 w-5 text-zinc-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-100 truncate">{doc.fileName}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          <span>{formatBytes(doc.fileSize)}</span>
                          <span>-</span>
                          <span>{doc.documentType || 'Unknown'}</span>
                          {doc.vendorName && (
                            <>
                              <span>-</span>
                              <span className="text-zinc-300">{doc.vendorName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {doc.totalAmount != null && (
                        <span className="text-sm font-bold text-zinc-200">
                          {formatCurrency(doc.totalAmount)}
                        </span>
                      )}
                      {statusBadge(doc.status)}
                      {doc.confidenceScore > 0 && (
                        <Badge
                          variant={
                            doc.confidenceScore > 80
                              ? 'success'
                              : doc.confidenceScore > 50
                                ? 'warning'
                                : 'destructive'
                          }
                        >
                          {doc.confidenceScore}%
                        </Badge>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocId(doc.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
