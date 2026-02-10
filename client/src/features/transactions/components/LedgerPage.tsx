/**
 * LedgerPage - Main orchestrator component for the transaction ledger
 *
 * This component composes all sub-components and coordinates all hooks
 * to provide a complete transaction management interface with:
 * - Responsive mobile/desktop layouts
 * - Filtering and sorting
 * - Inline editing
 * - Transaction splitting
 * - Delete confirmation
 * - CSV/Excel export
 * - Keyboard shortcuts (Ctrl+F for search, Escape for cancel/close)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import type { Transaction, Account } from '../types/ledger';

// Hooks
import { useLedgerFilters } from '../hooks/useLedgerFilters';
import { useLedgerData } from '../hooks/useLedgerData';
import { useInlineEdit } from '../hooks/useInlineEdit';
import { useTransactionSplit } from '../hooks/useTransactionSplit';
import { useBulkSelect } from '../hooks/useBulkSelect';

// Components
import { LedgerSkeleton } from './LedgerSkeleton';
import { LedgerHeader } from './LedgerHeader';
import { LedgerFilters } from './LedgerFilters';
import { LedgerSummaryBar } from './LedgerSummaryBar';
import { LedgerTable } from './LedgerTable';
import { TransactionCardList } from './TransactionCardList';
import { LedgerFooter } from './LedgerFooter';
import { SplitTransactionModal } from './SplitTransactionModal';
import { DeleteConfirmDialog, useDeleteConfirm } from './DeleteConfirmDialog';
import { BulkActionBar } from './BulkActionBar';
import { MobileLayout } from '@/components/layout/MobileLayout';

interface LedgerPageProps {
  transactions: Transaction[];
  accounts?: Account[];
  loading?: boolean;
  onDataChange?: () => void;
  totalTransactions?: number;
  onLoadMore?: () => void;
}

export function LedgerPage({
  transactions,
  accounts = [],
  loading = false,
  onDataChange,
  totalTransactions,
  onLoadMore,
}: LedgerPageProps) {
  // Filter hook - manages filter state, sorting, and filtered transactions
  const {
    filters,
    setFilters,
    showFilters,
    setShowFilters,
    sorting,
    setSorting,
    filteredTransactions,
    categories,
    hasActiveFilters,
    resetFilters,
  } = useLedgerFilters({ transactions });

  // Data/export hook - handles CSV/Excel export with current filters
  const { handleExport } = useLedgerData({ filters });

  // Edit hook - manages inline editing state and operations
  const {
    editingId,
    editForm,
    setEditForm,
    setEditingId,
    handleEditStart,
    handleSave,
    handleCancel,
    handleDelete: deleteTransaction,
  } = useInlineEdit({ transactions, onDataChange });

  // Split hook - manages transaction split modal state and operations
  const {
    splittingTx,
    splits,
    setSplits,
    handleSplitStart,
    handleSplitSave,
    handleSplitCancel,
    isSaving: isSplitSaving,
  } = useTransactionSplit({ onDataChange });

  // Bulk selection hook
  const {
    selectedIds,
    isSelected,
    toggle: toggleSelect,
    selectAll,
    clearSelection,
    selectedCount,
  } = useBulkSelect();

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Delete confirmation dialog hook
  const {
    isOpen: isDeleteOpen,
    itemToDelete,
    openDialog: openDeleteDialog,
    closeDialog: closeDeleteDialog,
    confirmDelete,
  } = useDeleteConfirm<string>();

  // Handle delete button click - opens confirmation dialog
  const handleDeleteClick = (id: string) => {
    openDeleteDialog(id);
  };

  // Handle confirmed delete - actually deletes the transaction
  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      await deleteTransaction(itemToDelete);
      confirmDelete();
    }
  };

  // Count active filters for mobile badge
  const activeFiltersCount = [
    filters.startDate,
    filters.endDate,
    filters.selectedCategory !== 'All' ? filters.selectedCategory : '',
    filters.globalFilter,
    filters.selectedAccount !== 'All' ? filters.selectedAccount : '',
    filters.minAmount,
    filters.maxAmount,
  ].filter(Boolean).length;

  // Ref for search input to enable Ctrl+F keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Memoize handleCancel for use in keyboard shortcut effect
  const memoizedHandleCancel = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Escape to cancel edit or close filters
      if (e.key === 'Escape') {
        if (editingId) {
          memoizedHandleCancel();
        } else if (showFilters) {
          setShowFilters(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingId, showFilters, memoizedHandleCancel, setShowFilters]);

  // Aria-live announcement state for screen readers
  const [announceMessage, setAnnounceMessage] = useState('');

  // Update announcement when filtered count changes
  useEffect(() => {
    setAnnounceMessage(
      `Showing ${filteredTransactions.length} of ${transactions.length} transactions`
    );
  }, [filteredTransactions.length, transactions.length]);

  // Loading state - show skeleton
  if (loading) {
    return <LedgerSkeleton />;
  }

  return (
    <>
      {/* Screen reader announcement for filter result changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announceMessage}
      </div>

      {/* Mobile Layout - hidden on md+ screens */}
      <MobileLayout
        title="Ledger"
        subtitle={`${filteredTransactions.length} transactions`}
        onFilterClick={() => setShowFilters(!showFilters)}
        activeFiltersCount={activeFiltersCount}
        summaryStats={<LedgerSummaryBar transactions={filteredTransactions} />}
      >
        {/* Mobile filters - expandable panel */}
        {(showFilters || hasActiveFilters) && (
          <LedgerFilters
            startDate={filters.startDate}
            endDate={filters.endDate}
            selectedCategory={filters.selectedCategory}
            minAmount={filters.minAmount?.toString() ?? ''}
            maxAmount={filters.maxAmount?.toString() ?? ''}
            selectedAccount={filters.selectedAccount}
            accounts={accounts}
            onStartDateChange={setFilters.setStartDate}
            onEndDateChange={setFilters.setEndDate}
            onCategoryChange={setFilters.setSelectedCategory}
            onMinAmountChange={setFilters.setMinAmount}
            onMaxAmountChange={setFilters.setMaxAmount}
            onAccountChange={setFilters.setSelectedAccount}
            onReset={resetFilters}
          />
        )}

        {/* Mobile transaction cards with virtualization */}
        <TransactionCardList
          transactions={filteredTransactions}
          accounts={accounts}
          onEdit={handleEditStart}
          onDelete={handleDeleteClick}
          onSplit={handleSplitStart}
          editingId={editingId}
          editForm={editForm}
          setEditForm={setEditForm}
          onSave={handleSave}
          onCancelEdit={handleCancel}
        />
      </MobileLayout>

      {/* Desktop Layout - hidden on mobile */}
      <div className="hidden md:block space-y-6 p-1">
        {/* Header card with search, filters toggle, export buttons */}
        <div className="neu-raised-sm lg:neu-raised rounded-3xl flex flex-col border border-white/10 shadow-[0_20px_70px_-10px_rgba(0,0,0,0.5)]">
          <LedgerHeader
            filteredCount={filteredTransactions.length}
            globalFilter={filters.globalFilter}
            onGlobalFilterChange={setFilters.setGlobalFilter}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
            hasActiveFilters={hasActiveFilters}
            onExport={handleExport}
            searchInputRef={searchInputRef}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
          />

          {/* Expandable filter panel */}
          {(showFilters || hasActiveFilters) && (
            <div className="p-6 pt-0">
              <LedgerFilters
                startDate={filters.startDate}
                endDate={filters.endDate}
                selectedCategory={filters.selectedCategory}
                minAmount={filters.minAmount?.toString() ?? ''}
                maxAmount={filters.maxAmount?.toString() ?? ''}
                selectedAccount={filters.selectedAccount}
                accounts={accounts}
                onStartDateChange={setFilters.setStartDate}
                onEndDateChange={setFilters.setEndDate}
                onCategoryChange={setFilters.setSelectedCategory}
                onMinAmountChange={setFilters.setMinAmount}
                onMaxAmountChange={setFilters.setMaxAmount}
                onAccountChange={setFilters.setSelectedAccount}
                onReset={resetFilters}
              />
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        <BulkActionBar
          selectedCount={selectedCount}
          selectedIds={selectedIds}
          onClearSelection={clearSelection}
          onDataChange={onDataChange}
        />

        {/* Desktop table with virtualization */}
        <div className="neu-raised-sm lg:neu-raised rounded-3xl overflow-hidden border border-white/10">
          <LedgerTable
            transactions={filteredTransactions}
            accounts={accounts}
            sorting={sorting}
            onSortingChange={setSorting}
            globalFilter={filters.globalFilter}
            onGlobalFilterChange={setFilters.setGlobalFilter}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            setEditingId={setEditingId}
            handleEditStart={handleEditStart}
            handleSave={handleSave}
            handleDelete={handleDeleteClick}
            handleSplitStart={handleSplitStart}
            categories={categories}
            bulkSelect={{ isSelected, toggle: toggleSelect }}
            onSelectAll={() => selectAll(filteredTransactions.map((t) => t.id))}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
          />

          <LedgerFooter
            totalCount={totalTransactions ?? transactions.length}
            filteredCount={filteredTransactions.length}
            loadedCount={transactions.length}
            onLoadMore={onLoadMore}
          />
        </div>
      </div>

      {/* Split Transaction Modal */}
      {splittingTx && (
        <SplitTransactionModal
          transaction={splittingTx}
          splits={splits}
          onSplitsChange={setSplits}
          onSave={handleSplitSave}
          onCancel={handleSplitCancel}
          isSaving={isSplitSaving}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteOpen}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteDialog}
      />
    </>
  );
}

// Re-export as default and named for backwards compatibility
export { LedgerPage as TransactionTable };
export default LedgerPage;
