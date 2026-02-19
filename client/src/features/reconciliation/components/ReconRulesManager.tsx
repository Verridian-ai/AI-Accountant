import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { reconApi } from '@/api';
import { cn } from '@/lib/utils';

interface MatchRule {
  id: string;
  name: string;
  matchType: string;
  matchConfig: Record<string, unknown>;
  autoConfirm: boolean;
  priority: number;
  isActive: boolean;
}

const MATCH_TYPES = [
  { value: 'amount_exact', label: 'Exact Amount' },
  { value: 'amount_date', label: 'Amount + Date' },
  { value: 'reference_number', label: 'Reference Number' },
  { value: 'description_pattern', label: 'Description Pattern' },
  { value: 'combined', label: 'Combined Weighted' },
];

const matchTypeBadgeColor: Record<string, string> = {
  amount_exact: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  amount_date: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  reference_number: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  description_pattern: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  combined: 'bg-cba-gold/20 text-cba-gold border-cba-gold/30',
};

export function ReconRulesManager() {
  const [rules, setRules] = useState<MatchRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formMatchType, setFormMatchType] = useState('amount_exact');
  const [formAutoConfirm, setFormAutoConfirm] = useState(false);
  const [formPriority, setFormPriority] = useState('10');
  // Match config fields
  const [formToleranceCents, setFormToleranceCents] = useState('0');
  const [formDateWindowDays, setFormDateWindowDays] = useState('3');
  const [formReferenceField, setFormReferenceField] = useState('reference');
  const [formDescPattern, setFormDescPattern] = useState('');

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const data = await reconApi.getRules();
      setRules(Array.isArray(data) ? data : (data.rules ?? []));
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildMatchConfig = (): Record<string, unknown> => {
    switch (formMatchType) {
      case 'amount_exact':
        return { tolerance_cents: parseInt(formToleranceCents) || 0 };
      case 'amount_date':
        return {
          tolerance_cents: parseInt(formToleranceCents) || 0,
          date_window_days: parseInt(formDateWindowDays) || 3,
        };
      case 'reference_number':
        return { reference_field: formReferenceField };
      case 'description_pattern':
        return { pattern: formDescPattern };
      case 'combined':
        return {
          field_weights: {
            amount: 0.4,
            date: 0.3,
            description: 0.3,
          },
        };
      default:
        return {};
    }
  };

  const handleAddRule = async () => {
    if (!formName.trim()) return;
    setSavingRule(true);
    try {
      await reconApi.createRule({
        name: formName,
        matchType: formMatchType,
        matchConfig: buildMatchConfig(),
        autoConfirm: formAutoConfirm,
        priority: parseInt(formPriority) || 10,
      });
      await loadRules();
      resetForm();
    } catch (err) {
      console.error('Failed to create rule:', err);
    } finally {
      setSavingRule(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormMatchType('amount_exact');
    setFormAutoConfirm(false);
    setFormPriority('10');
    setFormToleranceCents('0');
    setFormDateWindowDays('3');
    setFormReferenceField('reference');
    setFormDescPattern('');
    setShowAddForm(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-cba-gold" />
              Matching Rules
            </CardTitle>
            <CardDescription>
              Configure automatic bank reconciliation matching rules
            </CardDescription>
          </div>
          <Button
            size="sm"
            className="bg-cba-gold text-base hover:bg-cba-gold/90"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Rule Form */}
        {showAddForm && (
          <div className="neu-inset rounded-xl p-4 space-y-4 border border-cba-gold/20">
            <h4 className="text-sm font-bold text-primary">New Matching Rule</h4>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  placeholder="e.g., Exact amount match"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none">Match Type</p>
                <Select value={formMatchType} onValueChange={setFormMatchType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_TYPES.map((mt) => (
                      <SelectItem key={mt.value} value={mt.value}>
                        {mt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dynamic config fields based on match type */}
            <div className="grid gap-4 md:grid-cols-2">
              {(formMatchType === 'amount_exact' || formMatchType === 'amount_date') && (
                <div className="space-y-2">
                  <Label>Tolerance (cents)</Label>
                  <Input
                    type="number"
                    value={formToleranceCents}
                    onChange={(e) => setFormToleranceCents(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}
              {formMatchType === 'amount_date' && (
                <div className="space-y-2">
                  <Label>Date Window (days)</Label>
                  <Input
                    type="number"
                    value={formDateWindowDays}
                    onChange={(e) => setFormDateWindowDays(e.target.value)}
                    placeholder="3"
                  />
                </div>
              )}
              {formMatchType === 'reference_number' && (
                <div className="space-y-2">
                  <Label>Reference Field Name</Label>
                  <Input
                    value={formReferenceField}
                    onChange={(e) => setFormReferenceField(e.target.value)}
                    placeholder="reference"
                  />
                </div>
              )}
              {formMatchType === 'description_pattern' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Regex Pattern</Label>
                  <Input
                    value={formDescPattern}
                    onChange={(e) => setFormDescPattern(e.target.value)}
                    placeholder="e.g., ^TRANSFER.*"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-priority">Priority (lower = higher priority)</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  placeholder="10"
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="auto-confirm"
                  checked={formAutoConfirm}
                  onCheckedChange={setFormAutoConfirm}
                />
                <Label htmlFor="auto-confirm">Auto-confirm matches</Label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-primary"
                onClick={handleAddRule}
                disabled={savingRule || !formName.trim()}
              >
                {savingRule && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Save Rule
              </Button>
            </div>
          </div>
        )}

        {/* Rules list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No matching rules configured. Add a rule to automate reconciliation.
          </p>
        ) : (
          <div className="space-y-2">
            {rules
              .sort((a, b) => a.priority - b.priority)
              .map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    'neu-raised rounded-xl p-3 border transition-colors',
                    rule.isActive ? 'border-border/50' : 'border-border/50 opacity-50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-bold text-zinc-600 w-6 text-center shrink-0">
                        #{rule.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-primary truncate">{rule.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              matchTypeBadgeColor[rule.matchType] ?? '',
                            )}
                          >
                            {MATCH_TYPES.find((m) => m.value === rule.matchType)?.label ??
                              rule.matchType}
                          </Badge>
                          {rule.autoConfirm && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400"
                            >
                              Auto
                            </Badge>
                          )}
                          {!rule.isActive && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                      className="p-1 text-muted hover:text-primary transition-colors"
                    >
                      {expandedRule === rule.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Expanded config details */}
                  {expandedRule === rule.id && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                        Configuration
                      </p>
                      <pre className="text-xs text-secondary bg-zinc-900/50 rounded-lg p-2 overflow-x-auto">
                        {JSON.stringify(rule.matchConfig, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
