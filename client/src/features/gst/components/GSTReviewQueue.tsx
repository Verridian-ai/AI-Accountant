import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GSTBadge } from '@/components/common/GSTBadge';
import { formatCurrency } from '@/lib/format';
import { Loader2, Check, X, Pencil, ShieldCheck } from 'lucide-react';
import { gstApi } from '@/api';
import type { GSTReviewItem } from '@/features/gst/types';

interface GSTReviewQueueProps {
  businessOnly?: boolean;
}

export function GSTReviewQueue({ businessOnly: _businessOnly }: GSTReviewQueueProps = {}) {
  const [items, setItems] = useState<GSTReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await gstApi.fetchReviewQueue();
      setItems(data);
    } catch (err) {
      console.error('Failed to load GST review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (item: GSTReviewItem) => {
    setProcessingIds((prev) => new Set(prev).add(item.id));
    try {
      await gstApi.approveClassification(item.id, item.suggestedCategory);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleReject = async (id: number) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      await gstApi.approveClassification(id, 'private');
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkApprove = async () => {
    const eligible = items.filter((i) => i.confidence >= 0.5);
    const ids = eligible.map((i) => i.id);
    if (ids.length === 0) return;

    setProcessingIds(new Set(ids));
    try {
      await gstApi.bulkApprove(ids);
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    } catch (err) {
      console.error('Failed to bulk approve:', err);
    } finally {
      setProcessingIds(new Set());
    }
  };

  if (loading) {
    return (
      <Card className="neu-raised rounded-xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-cba-gold" />
          <span className="ml-2 text-secondary">Loading review queue...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">GST Review Queue</h3>
          {items.length > 0 && (
            <Badge variant="warning">
              {items.length} transaction{items.length !== 1 ? 's' : ''} need review
            </Badge>
          )}
        </div>
        {items.length > 0 && (
          <Button size="sm" onClick={handleBulkApprove} disabled={processingIds.size > 0}>
            <ShieldCheck className="w-4 h-4 mr-1" />
            Auto-accept &gt;50%
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="neu-raised rounded-xl">
          <CardContent className="text-center py-12">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
            <p className="text-secondary">All transactions have been reviewed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isProcessing = processingIds.has(item.id);
            return (
              <Card key={item.id} className="neu-raised rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate">{item.description}</span>
                        <GSTBadge
                          gstCategory={item.suggestedCategory}
                          gstAmount={item.suggestedGstAmount}
                          confidence={item.confidence}
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>{item.date}</span>
                        <span className={item.amount < 0 ? 'text-red-400' : 'text-emerald-400'}>
                          {formatCurrency(item.amount)}
                        </span>
                        <span>Confidence: {Math.round(item.confidence * 100)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => handleApprove(item)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleReject(item.id)}
                        disabled={isProcessing}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-secondary hover:bg-overlay"
                        disabled={isProcessing}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
