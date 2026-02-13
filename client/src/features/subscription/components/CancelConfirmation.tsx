import { useState } from 'react';
import { AlertTriangle, X, Gift, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantApi } from '@/api';

interface CancelConfirmationProps {
  planName: string;
  periodEnd: string;
  onClose: () => void;
  onCancelled?: () => void;
}

const LOST_FEATURES = [
  'AI-powered categorization and insights',
  'Multi-account support',
  'Cognee knowledge graph',
  'Team collaboration features',
  'Custom dashboards',
  'BAS auto-generation',
  'Tax optimization suggestions',
];

export function CancelConfirmation({
  planName,
  periodEnd,
  onClose,
  onCancelled,
}: CancelConfirmationProps) {
  const [confirmText, setConfirmText] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showRetention, setShowRetention] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenantId = localStorage.getItem('tenantId');

  const handleCancel = async () => {
    if (!tenantId || confirmText !== 'CANCEL') return;
    setCancelling(true);
    setError(null);
    try {
      await tenantApi.cancelSubscription(tenantId);
      onCancelled?.();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="neu-raised rounded-2xl border border-red-500/20 p-6 w-full max-w-lg space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-bold text-red-400">Cancel Subscription</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning */}
        <div className="neu-inset rounded-xl p-4 space-y-2">
          <p className="text-sm text-zinc-300">
            Your <span className="font-bold text-[#FFCC00]">{planName}</span> plan will remain
            active until <span className="font-bold text-zinc-200">{formatDate(periodEnd)}</span>.
          </p>
          <p className="text-sm text-zinc-400">
            After that, your workspace will be downgraded to the Starter plan with limited features.
          </p>
        </div>

        {/* Features Lost */}
        <div>
          <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">
            Features You'll Lose
          </p>
          <div className="space-y-1.5">
            {LOST_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-zinc-400">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Retention Offer */}
        {showRetention && (
          <div className="neu-raised rounded-xl border border-emerald-500/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-400" />
              <p className="text-sm font-bold text-emerald-400">Special Offer</p>
            </div>
            <p className="text-sm text-zinc-400">
              Stay on {planName} and get <span className="font-bold text-emerald-400">20% off</span>{' '}
              your next month.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <Check className="w-4 h-4" /> Keep My Plan
              </button>
              <button
                type="button"
                onClick={() => setShowRetention(false)}
                className="px-3 py-2 rounded-xl text-sm font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Continue Cancelling
              </button>
            </div>
          </div>
        )}

        {/* Confirmation */}
        {!showRetention && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Type <span className="font-bold text-red-400">CANCEL</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type CANCEL"
              className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-red-500/30 placeholder:text-zinc-600"
            />
            {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={confirmText !== 'CANCEL' || cancelling}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors',
                  confirmText === 'CANCEL'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
                )}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
