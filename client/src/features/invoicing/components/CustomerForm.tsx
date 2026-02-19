import { useState } from 'react';
import { invoicingApi } from '@/api';
import { Save, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerRecord {
  id: string;
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  abn?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  paymentTermsDays?: number;
  notes?: string;
}

interface CustomerFormProps {
  customer?: CustomerRecord;
  onSave: () => void;
  onCancel: () => void;
}

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;

interface FormData {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  abn: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  paymentTermsDays: string;
  notes: string;
}

interface FormErrors {
  businessName?: string;
  email?: string;
  abn?: string;
  postcode?: string;
}

export function CustomerForm({ customer, onSave, onCancel }: CustomerFormProps) {
  const isEditing = !!customer;

  const [form, setForm] = useState<FormData>({
    businessName: customer?.businessName ?? '',
    contactName: customer?.contactName ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    abn: customer?.abn ?? '',
    address: customer?.address ?? '',
    city: customer?.city ?? '',
    state: customer?.state ?? '',
    postcode: customer?.postcode ?? '',
    country: customer?.country ?? 'AU',
    paymentTermsDays: String(customer?.paymentTermsDays ?? 30),
    notes: customer?.notes ?? '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.businessName.trim()) {
      errs.businessName = 'Business name is required';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Invalid email address';
    }
    if (form.abn) {
      const digits = form.abn.replace(/\D/g, '');
      if (digits.length !== 11) {
        errs.abn = 'ABN must be 11 digits';
      }
    }
    if (form.postcode && !/^\d{4}$/.test(form.postcode)) {
      errs.postcode = 'Postcode must be 4 digits';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSaveError(null);

    const payload = {
      businessName: form.businessName.trim(),
      contactName: form.contactName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      abn: form.abn.replace(/\D/g, '') || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state || undefined,
      postcode: form.postcode.trim() || undefined,
      country: form.country || 'AU',
      paymentTermsDays: parseInt(form.paymentTermsDays, 10) || 30,
      notes: form.notes.trim() || undefined,
    };

    try {
      if (isEditing) {
        await invoicingApi.updateCustomer(customer.id, payload);
      } else {
        await invoicingApi.createCustomer(payload);
      }
      onSave();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const inputClass = (field?: keyof FormErrors) =>
    cn(
      'w-full px-3 py-2 rounded-xl neu-inset bg-transparent text-sm text-primary placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30',
      field && errors[field] && 'ring-1 ring-red-500/50',
    );

  return (
    <div className="neu-raised rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gradient-gold mb-5">
        {isEditing ? 'Edit Customer' : 'New Customer'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Business Name */}
        <div>
          <label htmlFor="invoic-f1" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
            Business Name <span className="text-red-400">*</span>
          </label>
          <input id="invoic-f1"
            type="text"
            value={form.businessName}
            onChange={(e) => setField('businessName', e.target.value)}
            placeholder="Enter business name"
            className={inputClass('businessName')}
          />
          {errors.businessName && (
            <p className="text-red-400 text-xs mt-1">{errors.businessName}</p>
          )}
        </div>

        {/* Contact + Email row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="invoic-f2" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
              Contact Name
            </label>
            <input id="invoic-f2"
              type="text"
              value={form.contactName}
              onChange={(e) => setField('contactName', e.target.value)}
              placeholder="Primary contact"
              className={inputClass()}
            />
          </div>
          <div>
            <label htmlFor="invoic-f3" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
              Email
            </label>
            <input id="invoic-f3"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="email@example.com"
              className={inputClass('email')}
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>
        </div>

        {/* Phone + ABN row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="invoic-f4" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
              Phone
            </label>
            <input id="invoic-f4"
              type="text"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="04XX XXX XXX"
              className={inputClass()}
            />
          </div>
          <div>
            <label htmlFor="invoic-f5" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
              ABN
            </label>
            <input id="invoic-f5"
              type="text"
              value={form.abn}
              onChange={(e) => setField('abn', e.target.value)}
              placeholder="XX XXX XXX XXX"
              maxLength={14}
              className={inputClass('abn')}
            />
            {errors.abn && <p className="text-red-400 text-xs mt-1">{errors.abn}</p>}
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="invoic-f6" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
            Address
          </label>
          <input id="invoic-f6"
            type="text"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="Street address"
            className={inputClass()}
          />
        </div>

        {/* City, State, Postcode, Country */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor="invoic-f7" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
              City
            </label>
            <input id="invoic-f7"
              type="text"
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              placeholder="City"
              className={inputClass()}
            />
          </div>
          <div>
            <label htmlFor="invoic-f8" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
              State
            </label>
            <select id="invoic-f8"
              value={form.state}
              onChange={(e) => setField('state', e.target.value)}
              className={cn(inputClass(), 'cursor-pointer')}
            >
              <option value="" className="bg-[#1a1b26]">
                Select...
              </option>
              {AU_STATES.map((s) => (
                <option key={s} value={s} className="bg-[#1a1b26]">
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="invoic-f9" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
              Postcode
            </label>
            <input id="invoic-f9"
              type="text"
              value={form.postcode}
              onChange={(e) => setField('postcode', e.target.value)}
              placeholder="0000"
              maxLength={4}
              className={inputClass('postcode')}
            />
            {errors.postcode && <p className="text-red-400 text-xs mt-1">{errors.postcode}</p>}
          </div>
          <div>
            <label htmlFor="invoic-f10" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
              Country
            </label>
            <input id="invoic-f10"
              type="text"
              value={form.country}
              onChange={(e) => setField('country', e.target.value)}
              placeholder="AU"
              className={inputClass()}
            />
          </div>
        </div>

        {/* Payment Terms */}
        <div className="sm:w-1/4">
          <label htmlFor="invoic-f11" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
            Payment Terms (days)
          </label>
          <input id="invoic-f11"
            type="number"
            value={form.paymentTermsDays}
            onChange={(e) => setField('paymentTermsDays', e.target.value)}
            min={0}
            max={365}
            className={inputClass()}
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="invoic-f12" className="block text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
            Notes
          </label>
          <textarea id="invoic-f12"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            rows={3}
            placeholder="Additional notes..."
            className={cn(inputClass(), 'resize-none')}
          />
        </div>

        {/* Error */}
        {saveError && <p className="text-red-400 text-sm">{saveError}</p>}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cba-gold text-base text-sm font-bold hover:bg-[#FFD633] transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(255,204,0,0.15)]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? 'Update Customer' : 'Create Customer'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-5 py-2 rounded-xl neu-raised text-secondary hover:text-zinc-100 text-sm transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
