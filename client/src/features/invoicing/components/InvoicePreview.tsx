import { Download, Printer } from 'lucide-react';
import { invoicingApi } from '@/api';
import { useState } from 'react';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  amount: number;
  gstAmount: number;
}

interface InvoiceData {
  id?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status?: string;
  customerName?: string;
  customerABN?: string;
  customerAddress?: string;
  customerEmail?: string;
  notes?: string;
  terms?: string;
  lineItems: LineItem[];
  subtotal: number;
  gstTotal: number;
  total: number;
}

interface InvoicePreviewProps {
  invoice: InvoiceData;
  businessName?: string;
  businessABN?: string;
  businessAddress?: string;
}

const formatAUD = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function InvoicePreview({
  invoice,
  businessName = 'Your Business Name',
  businessABN = '',
  businessAddress = '',
}: InvoicePreviewProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!invoice.id) return;
    setDownloading(true);
    try {
      const blob = await invoicingApi.downloadInvoicePDF(invoice.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2 print:hidden">
        {invoice.id && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl neu-raised text-sm font-semibold text-primary hover:text-zinc-100 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
        )}
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-xl neu-raised text-sm font-semibold text-primary hover:text-zinc-100 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      {/* Invoice Preview Card */}
      <div className="bg-white text-gray-900 rounded-2xl p-8 shadow-lg max-w-3xl mx-auto print:shadow-none print:rounded-none print:p-0 print:max-w-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{businessName}</h1>
            {businessABN && <p className="text-sm text-gray-500 mt-1">ABN: {businessABN}</p>}
            {businessAddress && <p className="text-sm text-gray-500">{businessAddress}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-cba-gold tracking-wider">TAX INVOICE</h2>
            <p className="text-sm text-gray-600 mt-1 font-mono">{invoice.invoiceNumber}</p>
          </div>
        </div>

        {/* Invoice Details + Bill To */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Bill To
            </h3>
            <p className="font-semibold text-gray-900">{invoice.customerName ?? '—'}</p>
            {invoice.customerABN && (
              <p className="text-sm text-gray-500">ABN: {invoice.customerABN}</p>
            )}
            {invoice.customerAddress && (
              <p className="text-sm text-gray-500">{invoice.customerAddress}</p>
            )}
            {invoice.customerEmail && (
              <p className="text-sm text-gray-500">{invoice.customerEmail}</p>
            )}
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <div>
                <span className="text-xs text-gray-400">Issue Date: </span>
                <span className="text-sm font-medium text-gray-700">
                  {formatDate(invoice.issueDate)}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400">Due Date: </span>
                <span className="text-sm font-medium text-gray-700">
                  {formatDate(invoice.dueDate)}
                </span>
              </div>
              {invoice.status && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase bg-gray-100 text-gray-600">
                    {invoice.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Description
              </th>
              <th className="text-right py-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Qty
              </th>
              <th className="text-right py-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Unit Price
              </th>
              <th className="text-right py-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                GST
              </th>
              <th className="text-right py-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((li, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-3 text-sm text-gray-800">{li.description || '—'}</td>
                <td className="py-3 text-sm text-gray-600 text-right">{li.quantity}</td>
                <td className="py-3 text-sm text-gray-600 text-right">{formatAUD(li.unitPrice)}</td>
                <td className="py-3 text-sm text-gray-600 text-right">{formatAUD(li.gstAmount)}</td>
                <td className="py-3 text-sm font-medium text-gray-900 text-right">
                  {formatAUD(li.amount + li.gstAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-800">{formatAUD(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">GST (10%)</span>
              <span className="font-medium text-gray-800">{formatAUD(invoice.gstTotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t-2 border-gray-300 pt-2">
              <span className="text-gray-900">Total Due</span>
              <span className="text-gray-900">{formatAUD(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms) && (
          <div className="border-t border-gray-200 pt-6 space-y-4">
            {invoice.notes && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Notes
                </h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Terms & Conditions
                </h4>
                <p className="text-sm text-gray-500 whitespace-pre-wrap">{invoice.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
