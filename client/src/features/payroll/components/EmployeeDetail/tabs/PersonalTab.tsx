import { Pencil, Check, X } from 'lucide-react';
import type { EmployeeRecord } from '../types.js';

interface PersonalTabProps {
  employee: EmployeeRecord;
  editing: boolean;
  editData: Record<string, string>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFieldChange: (field: string, value: string) => void;
}

export function PersonalTab({
  employee,
  editing,
  editData,
  onEdit,
  onSave,
  onCancel,
  onFieldChange,
}: PersonalTabProps) {
  const fields = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'date_of_birth', label: 'Date of Birth' },
    { key: 'address', label: 'Address' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-primary">Personal Information</h3>
        {!editing ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-cba-gold border border-border rounded-lg hover:border-cba-gold/30 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary border border-border rounded-lg transition-colors"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-black bg-cba-gold rounded-lg hover:bg-cba-gold/90 transition-colors"
            >
              <Check className="h-3 w-3" />
              Save
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-muted uppercase tracking-wider">
              {f.label}
            </label>
            {editing ? (
              <input
                type={f.key === 'date_of_birth' ? 'date' : 'text'}
                value={editData[f.key] ?? ''}
                onChange={(e) => onFieldChange(f.key, e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-overlay border border-border text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
              />
            ) : (
              <p className="text-sm text-primary mt-1">{(employee[f.key] as string) ?? '-'}</p>
            )}
          </div>
        ))}
        <div>
          <label className="text-xs font-medium text-muted uppercase tracking-wider">TFN</label>
          <p className="text-sm text-primary mt-1 font-mono">
            {(employee.tfn_masked as string) ?? '***-***-***'}
          </p>
        </div>
      </div>
    </div>
  );
}
