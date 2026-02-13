import { useState, useEffect, useRef } from 'react';
import {
  Building2,
  ChevronDown,
  Plus,
  Check,
  Shield,
  Eye,
  Calculator,
  BookOpen,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantApi } from '@/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  role: string;
  logoUrl?: string | null;
}

const ROLE_CONFIG: Record<string, { color: string; icon: typeof Crown }> = {
  owner: { color: 'text-[#FFCC00]', icon: Crown },
  admin: { color: 'text-blue-400', icon: Shield },
  accountant: { color: 'text-emerald-400', icon: Calculator },
  bookkeeper: { color: 'text-purple-400', icon: BookOpen },
  viewer: { color: 'text-zinc-400', icon: Eye },
};

export function TenantSwitcher() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(
    localStorage.getItem('tenantId'),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tenantApi.listMyTenants().then(setTenants).catch(console.error);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTenant = tenants.find((t) => t.id === currentTenantId) ?? tenants[0];

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === currentTenantId) {
      setIsOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const result = await tenantApi.switchTenant(tenantId);
      if (result.token) {
        localStorage.setItem('token', result.token);
      }
      localStorage.setItem('tenantId', tenantId);
      setCurrentTenantId(tenantId);
      setIsOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch tenant', err);
    } finally {
      setSwitching(false);
    }
  };

  if (tenants.length === 0) return null;

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'neu-raised-sm flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all',
          'hover:border-[#FFCC00]/30 border border-transparent',
          isOpen && 'border-[#FFCC00]/30 shadow-[0_0_12px_rgba(255,204,0,0.1)]',
        )}
      >
        <div className="w-6 h-6 rounded-lg bg-[#FFCC00]/10 flex items-center justify-center text-[#FFCC00] text-xs font-black">
          {currentTenant ? getInitial(currentTenant.name) : <Building2 className="w-3.5 h-3.5" />}
        </div>
        <span className="hidden sm:block text-zinc-200 max-w-[120px] truncate">
          {currentTenant?.name ?? 'Select Workspace'}
        </span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 text-zinc-500 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 neu-raised rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Workspaces
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {tenants.map((tenant) => {
              const isCurrent = tenant.id === currentTenantId;
              const role = ROLE_CONFIG[tenant.role] ?? ROLE_CONFIG.viewer;
              const RoleIcon = role.icon;
              return (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => handleSwitch(tenant.id)}
                  disabled={switching}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    isCurrent
                      ? 'bg-[#FFCC00]/5 border-l-2 border-[#FFCC00]'
                      : 'hover:bg-white/5 border-l-2 border-transparent',
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0',
                      isCurrent ? 'bg-[#FFCC00]/20 text-[#FFCC00]' : 'bg-white/5 text-zinc-400',
                    )}
                  >
                    {getInitial(tenant.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-bold truncate',
                        isCurrent ? 'text-[#FFCC00]' : 'text-zinc-200',
                      )}
                    >
                      {tenant.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <RoleIcon className={cn('w-3 h-3', role.color)} />
                      <span
                        className={cn('text-[10px] font-bold uppercase tracking-wider', role.color)}
                      >
                        {tenant.role}
                      </span>
                    </div>
                  </div>
                  {isCurrent && <Check className="w-4 h-4 text-[#FFCC00] shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-white/5 p-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                // Parent handles navigation to TenantCreate
                window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'settings' }));
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-[#FFCC00] hover:bg-[#FFCC00]/5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
