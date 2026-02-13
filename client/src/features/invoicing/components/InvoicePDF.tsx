import { useState } from 'react';
import { invoicingApi } from '@/api';
import { Download, Send, Printer, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoicePDFProps {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  onSent?: () => void;
  onPrint?: () => void;
}

export function InvoicePDF({ invoiceId, invoiceNumber, status, onSent, onPrint }: InvoicePDFProps) {
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadSuccess(false);
    try {
      const blob = await invoicingApi.downloadInvoicePDF(invoiceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setSendSuccess(false);
    try {
      await invoicingApi.sendInvoice(invoiceId);
      setSendSuccess(true);
      onSent?.();
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to send invoice:', err);
    } finally {
      setSending(false);
    }
  };

  const handlePrint = () => {
    onPrint?.();
    window.print();
  };

  return (
    <div className="flex flex-wrap gap-3">
      {/* Download PDF */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all',
          downloadSuccess
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'neu-raised text-zinc-200 hover:text-zinc-100',
        )}
      >
        {downloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : downloadSuccess ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {downloading ? 'Generating...' : downloadSuccess ? 'Downloaded' : 'Download PDF'}
      </button>

      {/* Send Invoice */}
      {(status === 'draft' || status === 'sent') && (
        <button
          onClick={handleSend}
          disabled={sending}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all',
            sendSuccess
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633] shadow-[0_0_15px_rgba(255,204,0,0.15)]',
          )}
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : sendSuccess ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sending ? 'Sending...' : sendSuccess ? 'Sent' : 'Send Invoice'}
        </button>
      )}

      {/* Print */}
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl neu-raised text-sm font-bold text-zinc-200 hover:text-zinc-100 transition-colors"
      >
        <Printer className="w-4 h-4" />
        Print
      </button>
    </div>
  );
}
