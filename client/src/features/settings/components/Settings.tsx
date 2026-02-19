import React, { useState, useEffect } from 'react';
import { api, type UserSettings } from '@/api';
import { getModelsByCapability, type ModelInfo } from '@/lib/models';
import {
  X,
  Save,
  Info,
  Loader2,
  CheckCircle2,
  Sparkles,
  Cpu,
  Zap,
  Activity,
  Brain,
  Edit2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [fetchState, setFetchState] = useState<{
    settings: UserSettings | null;
    loading: boolean;
  }>({ settings: null, loading: true });
  const { settings, loading } = fetchState;
  const [saveState, setSaveState] = useState<{ saving: boolean; saved: boolean }>({
    saving: false,
    saved: false,
  });
  const { saving, saved } = saveState;
  const [hoveredModel, setHoveredModel] = useState<ModelInfo | null>(null);

  const getSettings = () => api.fetchSettings();

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    getSettings()
      .then((data) => {
        if (active) setFetchState({ settings: data, loading: false });
      })
      .catch((error: unknown) => {
        console.error('Failed to fetch settings:', error);
        if (active) setFetchState((s) => ({ ...s, loading: false }));
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleSave = async () => {
    if (!settings) return;
    setSaveState({ saving: true, saved: false });
    try {
      await api.updateSettings(settings);
      setSaveState({ saving: false, saved: true });
      setTimeout(() => setSaveState((s) => ({ ...s, saved: false })), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveState({ saving: false, saved: false });
    }
  };

  if (!isOpen) return null;

  const chatModels = getModelsByCapability('chat');
  const visionModels = getModelsByCapability('vision');
  const embeddingModels = getModelsByCapability('embedding');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cba-gold/5 rounded-full blur-[128px] animate-breathe" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cba-gold/5 rounded-full blur-[100px] animate-breathe animate-delay-2s" />
      </div>

      <div className="neu-raised rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300 border border-border/50">
        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between border-b border-border/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-white/2 to-transparent pointer-events-none" />
          <div className="flex items-center gap-4 relative">
            <div className="relative group">
              <div className="absolute -inset-1 cba-gold-gradient rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative cba-gold-gradient p-3 rounded-xl">
                <Cpu className="w-6 h-6 text-base" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-gradient-gold">AI Model Settings</h2>
              <p className="text-muted text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cba-gold" />
                Configure neural engine preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 neu-raised-sm rounded-xl text-secondary hover:text-primary btn-press"
            aria-label="Close settings"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          {loading ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              {[...Array(5)].map((_, i) => (
                <div key={`sk-${i}`} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Task Sections */}
              <div className="space-y-8">
                <SettingSection
                  label="Statement Parsing (Text)"
                  description="Model used to extract transactions from text-based PDFs"
                  value={settings?.modelParsingText || ''}
                  onChange={(val) =>
                    setFetchState((fs) => ({
                      ...fs,
                      settings: fs.settings ? { ...fs.settings, modelParsingText: val } : null,
                    }))
                  }
                  models={chatModels}
                  onHover={setHoveredModel}
                  icon={<Activity className="w-4 h-4" />}
                />

                <SettingSection
                  label="Statement Parsing (Vision/OCR)"
                  description="Requires vision capability for scanned or image-based statements"
                  value={settings?.modelParsingVision || ''}
                  onChange={(val) =>
                    setFetchState((fs) => ({
                      ...fs,
                      settings: fs.settings ? { ...fs.settings, modelParsingVision: val } : null,
                    }))
                  }
                  models={visionModels}
                  onHover={setHoveredModel}
                  icon={<Zap className="w-4 h-4" />}
                />

                <SettingSection
                  label="Transaction Categorization"
                  description="Model that assigns tax categories and GST status"
                  value={settings?.modelCategorization || ''}
                  onChange={(val) =>
                    setFetchState((fs) => ({
                      ...fs,
                      settings: fs.settings ? { ...fs.settings, modelCategorization: val } : null,
                    }))
                  }
                  models={chatModels}
                  onHover={setHoveredModel}
                  icon={<Brain className="w-4 h-4" />}
                />

                <SettingSection
                  label="Chat Assistant"
                  description="The model you interact with in the sidebar"
                  value={settings?.modelChat || ''}
                  onChange={(val) =>
                    setFetchState((fs) => ({
                      ...fs,
                      settings: fs.settings ? { ...fs.settings, modelChat: val } : null,
                    }))
                  }
                  models={chatModels}
                  onHover={setHoveredModel}
                  icon={<Sparkles className="w-4 h-4" />}
                />

                <SettingSection
                  label="Embedding Model"
                  description="Used for semantic search and RAG knowledge base"
                  value={settings?.modelEmbedding || ''}
                  onChange={(val) =>
                    setFetchState((fs) => ({
                      ...fs,
                      settings: fs.settings ? { ...fs.settings, modelEmbedding: val } : null,
                    }))
                  }
                  models={embeddingModels}
                  onHover={setHoveredModel}
                  icon={<Info className="w-4 h-4" />}
                />
              </div>

              {/* Model Info Card */}
              {hoveredModel && (
                <div className="p-5 neu-inset rounded-2xl animate-in fade-in slide-in-from-bottom-2 border border-border/50">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 neu-raised-sm rounded-xl text-cba-gold">
                      <Info className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-zinc-100 uppercase tracking-wide text-sm">
                        {hoveredModel.name}
                      </h4>
                      <p className="text-muted mt-1 text-sm leading-relaxed">
                        {hoveredModel.description}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-[10px] font-black bg-cba-gold/10 text-cba-gold px-2.5 py-1 rounded-lg uppercase tracking-widest">
                          {hoveredModel.context} Context
                        </span>
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
                          ID: {hoveredModel.id}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-border/50 bg-white/1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-600">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
              Live System Sync Active
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-xs font-bold text-muted hover:text-primary transition-colors uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || !settings}
              className={cn(
                'flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all btn-press',
                saved
                  ? 'bg-emerald-500 text-primary shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'cba-gold-gradient text-base shadow-lg cba-gold-glow disabled:opacity-50',
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? 'Synced' : 'Save Config'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingSectionProps {
  label: string;
  description: string;
  value: string;
  onChange: (val: string) => void;
  models: ModelInfo[];
  onHover: (model: ModelInfo | null) => void;
  icon: React.ReactNode;
}

function SettingSection({
  label,
  description,
  value,
  onChange,
  models,
  onHover,
  icon,
}: SettingSectionProps) {
  return (
    <div className="group space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 neu-inset rounded-lg flex items-center justify-center text-zinc-600 group-hover:text-cba-gold transition-colors">
          {icon}
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-black text-primary uppercase tracking-widest">
            {label}
          </label>
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tight">
            {description}
          </span>
        </div>
      </div>
      <div className="relative">
        <select
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          onMouseEnter={() => {
            const model = models.find((m) => m.id === value);
            if (model) onHover(model);
          }}
          onMouseLeave={() => onHover(null)}
          className="w-full pl-4 pr-10 py-4 neu-inset rounded-2xl text-sm font-bold text-cba-gold bg-transparent border-none focus:ring-0 appearance-none transition-all cursor-pointer hover:bg-white/2"
        >
          {models.map((model) => (
            <option
              key={model.id}
              value={model.id}
              className="bg-surface text-primary font-medium"
            >
              {model.name}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 neu-raised-sm rounded-lg pointer-events-none text-muted group-hover:text-cba-gold transition-colors">
          <Edit2 className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
