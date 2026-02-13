import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Trash2,
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { documentsApi } from '@/api';
import type { OCRDocument } from '@/api';
import { LineItemEditor } from './LineItemEditor';

interface DocumentViewerProps {
  documentId: string;
  onBack: () => void;
}

function statusBadge(status: string) {
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
    case 'pending':
      return <Badge variant="secondary">{status}</Badge>;
    case 'matched':
      return <Badge>{status}</Badge>;
    case 'failed':
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function confidenceColor(score: number) {
  if (score > 80) return 'text-green-400';
  if (score > 50) return 'text-amber-400';
  return 'text-red-400';
}

function confidenceBarColor(score: number) {
  if (score > 80) return '[&_[role=progressbar]>div]:bg-green-500';
  if (score > 50) return '[&_[role=progressbar]>div]:bg-amber-500';
  return '[&_[role=progressbar]>div]:bg-red-500';
}

function formatCurrency(amount: number | undefined | null) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
    amount / 100,
  );
}

export function DocumentViewer({ documentId, onBack }: DocumentViewerProps) {
  const [doc, setDoc] = useState<OCRDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  const loadDocument = async () => {
    setLoading(true);
    try {
      const data = await documentsApi.get(documentId);
      setDoc(data);
    } catch (err) {
      console.error('Failed to load document', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const handleReprocess = async () => {
    setProcessing(true);
    try {
      await documentsApi.process(documentId);
      await loadDocument();
    } catch (err) {
      console.error('Failed to reprocess', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleClassify = async () => {
    setProcessing(true);
    try {
      await documentsApi.classify(documentId);
      await loadDocument();
    } catch (err) {
      console.error('Failed to classify', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    try {
      await documentsApi.delete(documentId);
      onBack();
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  if (loading) {
    return (
      <div className="neu-raised rounded-xl p-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="neu-raised rounded-xl p-8 text-center">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-zinc-400">Document not found</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 text-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  const gstValid =
    doc.subtotal != null && doc.gstAmount != null && doc.totalAmount != null
      ? Math.abs(doc.subtotal + doc.gstAmount - doc.totalAmount) < 2
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="neu-raised p-2 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-zinc-100">{doc.fileName}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {statusBadge(doc.status)}
              <span className="text-xs text-zinc-500">{doc.mimeType}</span>
              <span className="text-xs text-zinc-500">
                {new Date(doc.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReprocess}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg neu-raised text-sm font-semibold text-zinc-300 hover:text-[#FFCC00] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
            Re-process
          </button>
          <button
            onClick={handleClassify}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg neu-raised text-sm font-semibold text-zinc-300 hover:text-blue-400 transition-colors disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            Classify
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg neu-raised text-sm font-semibold text-zinc-300 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Metadata */}
        <div className="space-y-4">
          {/* Document Info */}
          <div className="neu-raised rounded-xl p-5">
            <h3 className="text-sm font-bold text-[#FFCC00] uppercase tracking-wide mb-3">
              Document Info
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-zinc-500 text-xs">Type</p>
                <p className="text-zinc-200 font-medium capitalize">
                  {doc.documentType || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Document Number</p>
                <p className="text-zinc-200 font-medium">{doc.documentNumber || '-'}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Document Date</p>
                <p className="text-zinc-200 font-medium">{doc.documentDate || '-'}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Due Date</p>
                <p className="text-zinc-200 font-medium">{doc.dueDate || '-'}</p>
              </div>
            </div>
          </div>

          {/* Vendor Info */}
          <div className="neu-raised rounded-xl p-5">
            <h3 className="text-sm font-bold text-[#FFCC00] uppercase tracking-wide mb-3">
              Vendor
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-zinc-500 text-xs">Name</p>
                <p className="text-zinc-200 font-medium">{doc.vendorName || '-'}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">ABN</p>
                <div className="flex items-center gap-2">
                  <p className="text-zinc-200 font-medium">{doc.vendorAbn || '-'}</p>
                  {doc.vendorAbn && (
                    <a
                      href={`https://abr.business.gov.au/ABN/View?abn=${doc.vendorAbn}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FFCC00] hover:text-[#FFCC00]/80"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* GST Summary */}
          <div className="neu-raised rounded-xl p-5">
            <h3 className="text-sm font-bold text-[#FFCC00] uppercase tracking-wide mb-3">
              Amounts
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span className="text-zinc-200 font-medium">{formatCurrency(doc.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">GST</span>
                <span className="text-zinc-200 font-medium">{formatCurrency(doc.gstAmount)}</span>
              </div>
              <div className="border-t border-white/5 pt-2 flex justify-between text-sm">
                <span className="text-zinc-300 font-semibold">Total</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-100 font-bold">{formatCurrency(doc.totalAmount)}</span>
                  {gstValid !== null &&
                    (gstValid ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Confidence */}
          <div className="neu-raised rounded-xl p-5">
            <h3 className="text-sm font-bold text-[#FFCC00] uppercase tracking-wide mb-3">
              Confidence
            </h3>
            <div className="flex items-center gap-3">
              <Progress value={doc.confidenceScore} className="flex-1 h-2.5" />
              <span className={`text-sm font-bold ${confidenceColor(doc.confidenceScore)}`}>
                {doc.confidenceScore}%
              </span>
            </div>
          </div>

          {doc.errorMessage && (
            <div className="neu-raised rounded-xl p-5 border border-red-500/20">
              <h3 className="text-sm font-bold text-red-400 uppercase tracking-wide mb-2">Error</h3>
              <p className="text-sm text-red-300">{doc.errorMessage}</p>
            </div>
          )}
        </div>

        {/* Right: Extracted Data */}
        <div className="space-y-4">
          <div className="neu-raised rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#FFCC00] uppercase tracking-wide">
                Extracted Data
              </h3>
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="text-xs px-2 py-1 rounded-md bg-white/5 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {showRawData ? 'Hide JSON' : 'Show JSON'}
              </button>
            </div>
            {showRawData && doc.extractedData ? (
              <div className="neu-inset rounded-lg p-4 overflow-auto max-h-96">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">
                  {JSON.stringify(doc.extractedData, null, 2)}
                </pre>
              </div>
            ) : !doc.extractedData ? (
              <div className="neu-inset rounded-lg p-6 text-center">
                <p className="text-zinc-500 text-sm">No extracted data available</p>
                <p className="text-zinc-600 text-xs mt-1">Process the document to extract data</p>
              </div>
            ) : (
              <div className="neu-inset rounded-lg p-4">
                <p className="text-zinc-400 text-sm">
                  Data extracted successfully. Click &quot;Show JSON&quot; to view raw data.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="neu-raised rounded-xl p-5">
        <h3 className="text-sm font-bold text-[#FFCC00] uppercase tracking-wide mb-4">
          Line Items
        </h3>
        <LineItemEditor documentId={documentId} />
      </div>
    </div>
  );
}
