import { useState, useEffect } from 'react';
import {
  User,
  CreditCard,
  Shield,
  FileText,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  createEmployee,
  addBankDetails,
  addSuperFund,
  submitTaxDeclaration,
  setPayStructure,
  fetchPayCategories,
} from '../../../api';

interface EmployeeOnboardingProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface PayCategory {
  id: string;
  name: string;
  type: string;
  rateType: string;
  defaultRate: number;
}

const STEPS = [
  { id: 'personal', label: 'Personal Details', icon: User },
  { id: 'bank', label: 'Bank Details', icon: CreditCard },
  { id: 'super', label: 'Super Fund', icon: Shield },
  { id: 'tax', label: 'Tax Declaration', icon: FileText },
  { id: 'pay', label: 'Pay Structure', icon: DollarSign },
] as const;

export function EmployeeOnboarding({ onComplete, onCancel }: EmployeeOnboardingProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payCategories, setPayCategories] = useState<PayCategory[]>([]);

  // Step 1: Personal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [taxFileNumber, setTaxFileNumber] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [employmentType, setEmploymentType] = useState<string>('full_time');

  // Step 2: Bank
  const [bsb, setBsb] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  // Step 3: Super
  const [fundName, setFundName] = useState('');
  const [fundABN, setFundABN] = useState('');
  const [usi, setUsi] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [contributionRate, setContributionRate] = useState(11.5);

  // Step 4: Tax
  const [taxFreeThreshold, setTaxFreeThreshold] = useState(true);
  const [helpDebt, setHelpDebt] = useState(false);
  const [sfssDebt, setSfssDebt] = useState(false);
  const [claimDependents, setClaimDependents] = useState(0);

  // Step 5: Pay
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [rate, setRate] = useState(0);
  const [rateType, setRateType] = useState('hourly');
  const [hoursPerWeek, setHoursPerWeek] = useState<number | undefined>(38);

  useEffect(() => {
    fetchPayCategories('default').then((result) => {
      setPayCategories(result.data ?? []);
    }).catch(() => {});
  }, []);

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return firstName.trim() !== '' && lastName.trim() !== '' && startDate !== '';
      case 1:
        return bsb.length === 6 && accountNumber.length >= 4 && accountName.trim() !== '';
      case 2:
        return fundName.trim() !== '';
      case 3:
        return true;
      case 4:
        return selectedCategoryId !== '' && rate > 0;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const emp = await createEmployee({
        userId: 'default',
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        dateOfBirth: dateOfBirth || undefined,
        address: address || undefined,
        taxFileNumber: taxFileNumber || undefined,
        startDate,
        employmentType,
      });

      if (emp.error) throw new Error(emp.error);
      const empId = emp.id;

      if (bsb && accountNumber && accountName) {
        await addBankDetails(empId, { bsb, accountNumber, accountName, isPrimary: true });
      }

      if (fundName) {
        await addSuperFund(empId, {
          fundName,
          fundABN: fundABN || undefined,
          usi: usi || undefined,
          memberNumber: memberNumber || undefined,
          contributionRate,
        });
      }

      await submitTaxDeclaration(empId, {
        taxFreeThreshold,
        helpDebt,
        sfssDebt,
        claimDependents,
        effectiveDate: startDate,
      });

      if (selectedCategoryId && rate > 0) {
        const rateCents = Math.round(rate * 100);
        const annualSalary = rateType === 'annual' ? rateCents : undefined;
        await setPayStructure(empId, {
          payCategoryId: selectedCategoryId,
          rate: rateCents,
          hoursPerWeek: hoursPerWeek ?? undefined,
          annualSalary,
          effectiveDate: startDate,
        });
      }

      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name *" value={firstName} onChange={setFirstName} placeholder="Jane" />
              <Field label="Last Name *" value={lastName} onChange={setLastName} placeholder="Smith" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="jane@example.com" />
              <Field label="Phone" value={phone} onChange={setPhone} placeholder="0412 345 678" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Date of Birth" value={dateOfBirth} onChange={setDateOfBirth} type="date" />
              <Field label="Start Date *" value={startDate} onChange={setStartDate} type="date" />
            </div>
            <Field label="Address" value={address} onChange={setAddress} placeholder="123 Main St, Sydney NSW 2000" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Tax File Number"
                value={taxFileNumber}
                onChange={(v) => setTaxFileNumber(v.replace(/\D/g, '').slice(0, 9))}
                type="password"
                placeholder="8-9 digits"
                hint={taxFileNumber && (taxFileNumber.length < 8 || taxFileNumber.length > 9) ? 'TFN must be 8-9 digits' : undefined}
              />
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Employment Type *</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="casual">Casual</option>
                  <option value="contractor">Contractor</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <Field
              label="BSB *"
              value={bsb}
              onChange={(v) => setBsb(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="062000"
              hint={bsb && bsb.length !== 6 ? 'BSB must be 6 digits' : undefined}
            />
            <Field
              label="Account Number *"
              value={accountNumber}
              onChange={(v) => setAccountNumber(v.replace(/\D/g, '').slice(0, 12))}
              placeholder="12345678"
            />
            <Field label="Account Name *" value={accountName} onChange={setAccountName} placeholder="Jane Smith" />
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Field label="Fund Name *" value={fundName} onChange={setFundName} placeholder="AustralianSuper" />
            <Field
              label="Fund ABN"
              value={fundABN}
              onChange={(v) => setFundABN(v.replace(/\D/g, '').slice(0, 11))}
              placeholder="11 digits"
              hint={fundABN && fundABN.length !== 11 ? 'ABN must be 11 digits' : undefined}
            />
            <Field label="USI" value={usi} onChange={setUsi} placeholder="Unique Superannuation Identifier" />
            <Field label="Member Number" value={memberNumber} onChange={setMemberNumber} placeholder="MEM123456" />
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Contribution Rate (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={contributionRate}
                  onChange={(e) => setContributionRate(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                />
                {contributionRate < 11.5 && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Below the SG minimum (11.5%)
                  </p>
                )}
                {contributionRate >= 11.5 && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Meets SG minimum requirement
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <Toggle label="Claim tax-free threshold" checked={taxFreeThreshold} onChange={setTaxFreeThreshold} />
            <Toggle label="HELP / HECS debt" checked={helpDebt} onChange={setHelpDebt} />
            <Toggle label="SFSS debt" checked={sfssDebt} onChange={setSfssDebt} />
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Dependents</label>
              <input
                type="number"
                min="0"
                value={claimDependents}
                onChange={(e) => setClaimDependents(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Pay Category *</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  const cat = payCategories.find((c) => c.id === e.target.value);
                  if (cat) {
                    setRateType(cat.rateType);
                    if (cat.defaultRate) setRate(cat.defaultRate / 100);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              >
                <option value="">Select a category...</option>
                {payCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type} — {cat.rateType})
                  </option>
                ))}
              </select>
              {payCategories.length === 0 && (
                <p className="text-xs text-zinc-500 mt-1">No pay categories found. Create one first in the Pay Categories tab.</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Rate Type</label>
                <select
                  value={rateType}
                  onChange={(e) => setRateType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
                >
                  <option value="hourly">Hourly</option>
                  <option value="annual">Annual</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <Field
                label={`Rate ($${rateType === 'annual' ? '/year' : rateType === 'hourly' ? '/hour' : ''}) *`}
                value={rate === 0 ? '' : String(rate)}
                onChange={(v) => setRate(Number(v) || 0)}
                type="number"
                placeholder="0.00"
              />
            </div>
            {rateType === 'hourly' && (
              <Field
                label="Hours per Week"
                value={hoursPerWeek !== undefined ? String(hoursPerWeek) : ''}
                onChange={(v) => setHoursPerWeek(v ? Number(v) : undefined)}
                type="number"
                placeholder="38"
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Progress Indicator */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                i === step
                  ? 'bg-[#FFCC00]/10 text-[#FFCC00] ring-1 ring-[#FFCC00]/20'
                  : i < step
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-zinc-500 bg-white/5'
              }`}
            >
              <s.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className={`h-4 w-4 flex-shrink-0 ${i < step ? 'text-emerald-400' : 'text-zinc-600'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="neu-raised rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">{STEPS[step].label}</h2>
        <p className="text-sm text-zinc-500 mb-6">
          Step {step + 1} of {STEPS.length}
        </p>
        {renderStep()}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={step === 0 ? onCancel : () => setStep(step - 1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-zinc-300 text-sm font-medium hover:bg-white/10 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFCC00] text-black text-sm font-semibold hover:bg-[#FFCC00]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(255,204,0,0.15)]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !canProceed()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFCC00] text-black text-sm font-semibold hover:bg-[#FFCC00]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(255,204,0,0.15)]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Create Employee
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
      />
      {hint && (
        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {hint}
        </p>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-zinc-300 group-hover:text-white transition">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-[#FFCC00]' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}
