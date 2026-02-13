import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2 } from 'lucide-react';
import { entityApi } from '@/api';
import type { EntityData, EntityWithDetails } from '@/api';
import { toast } from 'sonner';

const ENTITY_TYPES: Array<{ value: EntityData['entityType']; label: string; description: string }> =
  [
    {
      value: 'sole_trader',
      label: 'Sole Trader',
      description: 'Individual trading — income taxed at personal rates',
    },
    {
      value: 'company',
      label: 'Company',
      description: '25-30% flat tax rate, separate legal entity',
    },
    {
      value: 'trust',
      label: 'Trust',
      description: 'Distributes income to beneficiaries, flexible tax planning',
    },
    { value: 'partnership', label: 'Partnership', description: 'Income split between partners' },
    {
      value: 'smsf',
      label: 'SMSF',
      description: 'Self-managed super fund — 15% concessional tax rate',
    },
    { value: 'individual', label: 'Individual', description: 'Personal, non-business entity' },
  ];

interface CreateEntityFormProps {
  existingEntities: EntityWithDetails[];
  onSuccess: () => void;
  onCancel: () => void;
}

function formatABN(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}

function validateABN(abn: string): boolean {
  const digits = abn.replace(/\D/g, '');
  return digits.length === 11;
}

export function CreateEntityForm({ existingEntities, onSuccess, onCancel }: CreateEntityFormProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState<EntityData['entityType']>('sole_trader');
  const [abn, setAbn] = useState('');
  const [acn, setAcn] = useState('');
  const [parentEntityId, setParentEntityId] = useState<string>('none');
  const [financialYearEnd, setFinancialYearEnd] = useState('06-30');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const abnDigits = abn.replace(/\D/g, '');
  const abnValid = abnDigits.length === 0 || validateABN(abn);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Entity name is required');
      return;
    }
    if (abn && !validateABN(abn)) {
      toast.error('ABN must be 11 digits');
      return;
    }

    setSaving(true);
    try {
      await entityApi.createEntity({
        name: name.trim(),
        entityType,
        abn: abnDigits || undefined,
        acn: acn.trim() || undefined,
        parentEntityId: parentEntityId !== 'none' ? parentEntityId : undefined,
        financialYearEnd,
        address: address.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        isConsolidatedParent: false,
        status: 'active',
      });
      toast.success(`Entity "${name}" created successfully`);
      onSuccess();
    } catch (err) {
      console.error('Failed to create entity:', err);
      toast.error('Failed to create entity');
    } finally {
      setSaving(false);
    }
  };

  const selectedTypeInfo = ENTITY_TYPES.find((t) => t.value === entityType);

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2 text-gradient-gold">
          <Building2 className="w-5 h-5" />
          Create New Entity
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Entity Name */}
          <div className="space-y-1.5">
            <Label htmlFor="entity-name">Entity Name *</Label>
            <Input
              id="entity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Smith Trading Pty Ltd"
              required
            />
          </div>

          {/* Entity Type */}
          <div className="space-y-1.5">
            <Label>Entity Type *</Label>
            <Select
              value={entityType}
              onValueChange={(v: EntityData['entityType']) => setEntityType(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTypeInfo && (
              <p className="text-xs text-zinc-500">{selectedTypeInfo.description}</p>
            )}
          </div>

          {/* ABN */}
          <div className="space-y-1.5">
            <Label htmlFor="entity-abn">ABN</Label>
            <Input
              id="entity-abn"
              value={abn}
              onChange={(e) => setAbn(formatABN(e.target.value))}
              placeholder="XX XXX XXX XXX"
              maxLength={14}
            />
            {abn && !abnValid && <p className="text-xs text-red-400">ABN must be 11 digits</p>}
          </div>

          {/* ACN - only for companies */}
          {entityType === 'company' && (
            <div className="space-y-1.5">
              <Label htmlFor="entity-acn">ACN</Label>
              <Input
                id="entity-acn"
                value={acn}
                onChange={(e) => setAcn(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="9-digit ACN"
                maxLength={9}
              />
            </div>
          )}

          {/* Parent Entity */}
          {existingEntities.length > 0 && (
            <div className="space-y-1.5">
              <Label>Parent Entity</Label>
              <Select value={parentEntityId} onValueChange={setParentEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="None (root entity)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (root entity)</SelectItem>
                  {existingEntities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Financial Year End */}
          <div className="space-y-1.5">
            <Label>Financial Year End</Label>
            <Select value={financialYearEnd} onValueChange={setFinancialYearEnd}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="06-30">30 June (Standard AU)</SelectItem>
                <SelectItem value="12-31">31 December</SelectItem>
                <SelectItem value="03-31">31 March</SelectItem>
                <SelectItem value="09-30">30 September</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="entity-address">Address</Label>
            <Input
              id="entity-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Registered address"
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-1.5">
            <Label htmlFor="entity-email">Contact Email</Label>
            <Input
              id="entity-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="admin@company.com.au"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 font-bold flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Entity'
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
