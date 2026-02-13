import { useState, useEffect } from 'react';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { apApi } from '../../../api';
import type { Supplier } from '../../../api';

interface SupplierFormProps {
  supplierId?: string;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  abn: string;
  paymentTermsDays: number;
  bankBsb: string;
  bankAccountNumber: string;
  bankAccountName: string;
  notes: string;
}

interface FormErrors {
  businessName?: string;
  abn?: string;
  bankBsb?: string;
  email?: string;
}

const PAYMENT_TERMS_OPTIONS = [7, 14, 30, 60];

export function SupplierForm({ supplierId, onSave, onCancel }: SupplierFormProps) {
  const isEdit = !!supplierId;
  const [form, setForm] = useState<FormData>({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    abn: '',
    paymentTermsDays: 30,
    bankBsb: '',
    bankAccountNumber: '',
    bankAccountName: '',
    notes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit && supplierId) {
      apApi.fetchSupplier(supplierId).then((s) => {
        setForm({
          businessName: s.businessName,
          contactName: s.contactName ?? '',
          email: s.email ?? '',
          phone: s.phone ?? '',
          address: s.address ?? '',
          abn: s.abn ?? '',
          paymentTermsDays: s.paymentTermsDays,
          bankBsb: s.bankBsb ?? '',
          bankAccountNumber: s.bankAccountNumber ?? '',
          bankAccountName: s.bankAccountName ?? '',
          notes: s.notes ?? '',
        });
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [isEdit, supplierId]);

  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!form.businessName.trim()) {
      errs.businessName = 'Business name is required';
    }

    if (form.abn) {
      const digits = form.abn.replace(/\D/g, '');
      if (digits.length !== 11) {
        errs.abn = 'ABN must be exactly 11 digits';
      }
    }

    if (form.bankBsb) {
      const bsbDigits = form.bankBsb.replace(/\D/g, '');
      if (bsbDigits.length !== 6) {
        errs.bankBsb = 'BSB must be 6 digits (XXX-XXX)';
      }
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Invalid email address';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const data: Partial<Supplier> = {
        businessName: form.businessName.trim(),
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        abn: form.abn.replace(/\D/g, '') || undefined,
        paymentTermsDays: form.paymentTermsDays,
        bankBsb: formatBSB(form.bankBsb) || undefined,
        bankAccountNumber: form.bankAccountNumber.trim() || undefined,
        bankAccountName: form.bankAccountName.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      if (isEdit && supplierId) {
        await apApi.updateSupplier(supplierId, data);
      } else {
        await apApi.createSupplier(data);
      }
      onSave();
    } catch (e) {
      console.error('Failed to save supplier', e);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof FormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <button onClick={onCancel} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="neu-raised rounded-2xl p-6 animate-pulse">
          <div className="h-6 w-48 bg-white/5 rounded mb-4" />
          <div className="h-4 w-32 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold text-white">
          {isEdit ? 'Edit Supplier' : 'New Supplier'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isEdit ? 'Update supplier details' : 'Add a new supplier to your directory'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Details */}
        <div className="neu-raised rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">Business Details</h3>

          <FormField label="Business Name *" error={errors.businessName}>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => updateField('businessName', e.target.value)}
              className={inputClass(errors.businessName)}
              placeholder="e.g. Acme Supplies Pty Ltd"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Contact Name">
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => updateField('contactName', e.target.value)}
                className={inputClass()}
                placeholder="e.g. John Smith"
              />
            </FormField>

            <FormField label="ABN" error={errors.abn}>
              <input
                type="text"
                value={form.abn}
                onChange={(e) => updateField('abn', e.target.value)}
                className={inputClass(errors.abn)}
                placeholder="XX XXX XXX XXX"
                maxLength={14}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Email" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={inputClass(errors.email)}
                placeholder="supplier@example.com"
              />
            </FormField>

            <FormField label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className={inputClass()}
                placeholder="0X XXXX XXXX"
              />
            </FormField>
          </div>

          <FormField label="Address">
            <textarea
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              className={inputClass() + ' resize-none'}
              rows={2}
              placeholder="Street address, city, state, postcode"
            />
          </FormField>

          <FormField label="Payment Terms">
            <select
              value={form.paymentTermsDays}
              onChange={(e) => updateField('paymentTermsDays', Number(e.target.value))}
              className={inputClass()}
            >
              {PAYMENT_TERMS_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Bank Details */}
        <div className="neu-raised rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">Bank Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="BSB" error={errors.bankBsb}>
              <input
                type="text"
                value={form.bankBsb}
                onChange={(e) => updateField('bankBsb', e.target.value)}
                className={inputClass(errors.bankBsb)}
                placeholder="XXX-XXX"
                maxLength={7}
              />
            </FormField>

            <FormField label="Account Number">
              <input
                type="text"
                value={form.bankAccountNumber}
                onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                className={inputClass()}
                placeholder="Account number"
              />
            </FormField>

            <FormField label="Account Name">
              <input
                type="text"
                value={form.bankAccountName}
                onChange={(e) => updateField('bankAccountName', e.target.value)}
                className={inputClass()}
                placeholder="Account name"
              />
            </FormField>
          </div>
        </div>

        {/* Notes */}
        <div className="neu-raised rounded-2xl p-6">
          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className={inputClass() + ' resize-none'}
              rows={3}
              placeholder="Internal notes about this supplier..."
            />
          </FormField>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-white/5 text-zinc-300 text-sm font-medium hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFCC00] text-black font-semibold text-sm hover:bg-[#FFCC00]/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : isEdit ? 'Update Supplier' : 'Create Supplier'}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
      {error && (
        <p className="flex items-center gap-1 mt-1 text-xs text-red-400">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function inputClass(error?: string): string {
  return `w-full px-3 py-2.5 rounded-xl bg-white/5 border text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 transition-all ${
    error
      ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20'
      : 'border-white/10 focus:border-[#FFCC00]/30 focus:ring-[#FFCC00]/20'
  }`;
}

function formatBSB(bsb: string): string {
  const digits = bsb.replace(/\D/g, '');
  if (digits.length === 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return bsb;
}
