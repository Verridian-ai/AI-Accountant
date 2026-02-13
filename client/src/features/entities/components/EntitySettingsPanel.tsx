import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Loader2, Check } from 'lucide-react';
import { entityApi } from '@/api';
import type { EntityWithDetails, EntitySettingData } from '@/api';
import { toast } from 'sonner';

interface EntitySettingsPanelProps {
  entities: EntityWithDetails[];
}

export function EntitySettingsPanel({ entities }: EntitySettingsPanelProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string>(entities[0]?.id ?? '');
  const [settings, setSettings] = useState<EntitySettingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);

  useEffect(() => {
    if (selectedEntity?.settings) {
      setSettings({ ...selectedEntity.settings });
    } else {
      setSettings({
        basReportingFrequency: 'quarterly',
        gstRegistered: false,
        gstMethod: 'cash',
        taxRate: 25,
        defaultDepreciationMethod: 'diminishing_value',
        instantWriteOffThreshold: 2000000,
      });
    }
  }, [selectedEntityId, selectedEntity]);

  const debouncedSave = useCallback(
    (updated: EntitySettingData) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(async () => {
        if (!selectedEntityId) return;
        setSaving(true);
        setSaved(false);
        try {
          await entityApi.updateSettings(selectedEntityId, updated);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } catch (err) {
          console.error('Failed to save settings:', err);
          toast.error('Failed to save settings');
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [selectedEntityId],
  );

  const updateSetting = <K extends keyof EntitySettingData>(
    key: K,
    value: EntitySettingData[K],
  ) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    debouncedSave(updated);
  };

  if (entities.length === 0) {
    return (
      <Card className="neu-raised border-0">
        <CardContent className="p-8 text-center">
          <Settings className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
          <h3 className="text-lg font-bold text-zinc-300 mb-1">No Entities</h3>
          <p className="text-sm text-zinc-500">Create an entity first to configure settings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Entity Selector */}
      <div className="flex items-center gap-3">
        <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select entity" />
          </SelectTrigger>
          <SelectContent>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving...
          </span>
        )}
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Check className="w-3 h-3" />
            Saved
          </span>
        )}
      </div>

      {!settings ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* BAS Reporting Frequency */}
          <Card className="neu-raised border-0">
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-sm font-bold text-zinc-200">BAS Reporting Frequency</Label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  How often you lodge your Business Activity Statement
                </p>
              </div>
              <Select
                value={settings.basReportingFrequency}
                onValueChange={(v) => updateSetting('basReportingFrequency', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* GST Registered */}
          <Card className="neu-raised border-0">
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-sm font-bold text-zinc-200">GST Registered</Label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Required if annual turnover exceeds $75,000 ($150,000 for non-profits)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={settings.gstRegistered}
                  onCheckedChange={(v) => updateSetting('gstRegistered', v)}
                />
                <span className="text-sm text-zinc-400">
                  {settings.gstRegistered ? 'Registered' : 'Not registered'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* GST Method — only shown if registered */}
          {settings.gstRegistered && (
            <Card className="neu-raised border-0">
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-sm font-bold text-zinc-200">GST Method</Label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Cash: report when paid. Accrual: report when invoiced.
                  </p>
                </div>
                <Select
                  value={settings.gstMethod}
                  onValueChange={(v) => updateSetting('gstMethod', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="accrual">Accrual</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Tax Rate */}
          <Card className="neu-raised border-0">
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-sm font-bold text-zinc-200">Tax Rate (%)</Label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Company: 25% (base rate) or 30%. Trusts: distributed to beneficiaries.
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={settings.taxRate}
                onChange={(e) => updateSetting('taxRate', parseFloat(e.target.value) || 0)}
              />
            </CardContent>
          </Card>

          {/* Depreciation Method */}
          <Card className="neu-raised border-0">
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-sm font-bold text-zinc-200">
                  Default Depreciation Method
                </Label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Method used for new assets unless overridden per asset
                </p>
              </div>
              <Select
                value={settings.defaultDepreciationMethod}
                onValueChange={(v) => updateSetting('defaultDepreciationMethod', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight_line">Straight Line</SelectItem>
                  <SelectItem value="diminishing_value">Diminishing Value</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Instant Write-Off Threshold */}
          <Card className="neu-raised border-0">
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-sm font-bold text-zinc-200">
                  Instant Write-Off Threshold ($)
                </Label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Assets under this value can be immediately deducted. Default: $20,000
                </p>
              </div>
              <Input
                type="number"
                min={0}
                step={1000}
                value={settings.instantWriteOffThreshold / 100}
                onChange={(e) =>
                  updateSetting(
                    'instantWriteOffThreshold',
                    Math.round((parseFloat(e.target.value) || 0) * 100),
                  )
                }
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
