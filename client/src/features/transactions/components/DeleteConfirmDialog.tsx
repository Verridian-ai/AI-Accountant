import { useEffect, useRef, useCallback, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * DeleteConfirmDialog - Accessible modal for delete confirmation
 *
 * Features:
 * - ARIA attributes for screen readers (alertdialog role)
 * - Focus trap (Tab/Shift+Tab contained within modal)
 * - Escape key closes modal
 * - Focus restoration to trigger element
 * - Semi-transparent backdrop with blur
 * - Matches existing design system (neu-raised, cba-gold colors)
 */
export function DeleteConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Delete Transaction',
  message = 'Are you sure you want to delete this transaction? This action cannot be undone.',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
}: DeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the dialog
  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled'));
  }, []);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the cancel button initially (safer default for destructive action)
    cancelButtonRef.current?.focus();

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      // Focus trap on Tab
      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) return;

        if (e.shiftKey) {
          // Shift+Tab: if on first element, wrap to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      // Restore focus to the previously focused element
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onCancel, getFocusableElements]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        className={cn(
          'relative neu-raised rounded-2xl p-6 max-w-md w-full mx-4',
          'border border-border',
          'animate-in zoom-in-95 fade-in duration-200',
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'absolute top-4 right-4 p-1.5 rounded-lg',
            'text-muted hover:text-primary',
            'hover:bg-overlay transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50',
          )}
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 neu-inset rounded-2xl flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>

        {/* Title */}
        <h2
          id="delete-dialog-title"
          className="text-xl font-black text-center text-zinc-100 mb-2 uppercase tracking-wide"
        >
          {title}
        </h2>

        {/* Message */}
        <p
          id="delete-dialog-description"
          className="text-sm text-center text-secondary mb-6 leading-relaxed"
        >
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className={cn(
              'flex-1 py-3 px-4 rounded-xl',
              'neu-raised-sm border border-border/50',
              'text-primary font-black uppercase text-xs tracking-widest',
              'hover:text-cba-gold hover:border-cba-gold/20',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50',
            )}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={cn(
              'flex-1 py-3 px-4 rounded-xl',
              'bg-red-500/10 border border-red-500/30',
              'text-red-400 font-black uppercase text-xs tracking-widest',
              'hover:bg-red-500/20 hover:border-red-500/50',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-red-500/50',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing delete confirmation dialog state
 *
 * Usage:
 * ```tsx
 * const { isOpen, itemToDelete, openDialog, closeDialog, confirmDelete } = useDeleteConfirm();
 *
 * // When user clicks delete
 * const handleDelete = (id: string) => openDialog(id);
 *
 * // In the dialog's onConfirm
 * const handleConfirm = () => {
 *   if (itemToDelete) {
 *     deleteItem(itemToDelete);
 *   }
 *   confirmDelete();
 * };
 *
 * // Render
 * <DeleteConfirmDialog
 *   isOpen={isOpen}
 *   onConfirm={handleConfirm}
 *   onCancel={closeDialog}
 * />
 * ```
 */
export function useDeleteConfirm<T = string>() {
  const [isOpen, setIsOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<T | null>(null);

  const openDialog = useCallback((item: T) => {
    setItemToDelete(item);
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setItemToDelete(null);
  }, []);

  const confirmDelete = useCallback(() => {
    setIsOpen(false);
    // Keep itemToDelete briefly so consumer can access it in onConfirm
    setTimeout(() => setItemToDelete(null), 100);
  }, []);

  return {
    isOpen,
    itemToDelete,
    openDialog,
    closeDialog,
    confirmDelete,
  };
}

export default DeleteConfirmDialog;
