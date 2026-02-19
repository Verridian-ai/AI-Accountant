import { useState, useEffect } from 'react';
import { UserPlus, X, Mail, Shield, Crown, Eye, Calculator, BookOpen, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantApi } from '@/api';

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  lastActiveAt?: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const ROLES = ['owner', 'admin', 'accountant', 'bookkeeper', 'viewer'] as const;

const ROLE_STYLES: Record<string, { bg: string; text: string; icon: typeof Crown }> = {
  owner: { bg: 'bg-cba-gold/10', text: 'text-cba-gold', icon: Crown },
  admin: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Shield },
  accountant: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: Calculator },
  bookkeeper: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: BookOpen },
  viewer: { bg: 'bg-zinc-500/10', text: 'text-secondary', icon: Eye },
};

export function MemberManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('viewer');
  const [inviting, setInviting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tenantId = localStorage.getItem('tenantId');

  const load = () => {
    if (!tenantId) return;
    tenantApi.listMembers(tenantId).then(setMembers).catch(console.error);
    tenantApi.listInvitations(tenantId).then(setInvitations).catch(console.error);
  };

  useEffect(load, [tenantId]);

  const handleInvite = async () => {
    if (!tenantId || !inviteEmail) return;
    setInviting(true);
    setError(null);
    try {
      await tenantApi.inviteMember(tenantId, inviteEmail, inviteRole);
      setInviteEmail('');
      setShowInvite(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!tenantId) return;
    try {
      await tenantApi.updateMemberRole(tenantId, memberId, newRole);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!tenantId) return;
    try {
      await tenantApi.removeMember(tenantId, memberId);
      setConfirmRemove(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!tenantId) return;
    try {
      await tenantApi.revokeInvitation(tenantId, invitationId);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invitation');
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Team Members</h2>
          <p className="text-sm text-muted">Manage who has access to this workspace</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-cba-gold text-base hover:bg-[#FFD633] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {error && (
        <div className="neu-raised rounded-xl border border-red-500/20 px-4 py-3 text-sm text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="neu-raised rounded-2xl border border-border p-6 w-full max-w-md space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-100">Invite Member</h3>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="p-1 rounded-lg text-muted hover:text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label
                htmlFor="invite-email"
                className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full neu-inset pl-10 pr-3 py-2.5 rounded-xl text-sm text-primary bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30 placeholder:text-zinc-600"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="invite-role"
                className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5"
              >
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full neu-inset px-3 py-2.5 rounded-xl text-sm text-primary bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {ROLES.filter((r) => r !== 'owner').map((r) => (
                  <option key={r} value={r} className="bg-[#16213e]">
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-cba-gold text-base hover:bg-[#FFD633] transition-colors disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {inviting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="neu-raised rounded-2xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">
                  Member
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest hidden md:table-cell">
                  Joined
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest hidden lg:table-cell">
                  Last Active
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-muted uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const style = ROLE_STYLES[member.role] ?? ROLE_STYLES.viewer;
                const _RoleIcon = style.icon;
                return (
                  <tr
                    key={member.id}
                    className="border-b border-border/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-bold text-primary">{member.name}</p>
                        <p className="text-xs text-muted">{member.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        disabled={member.role === 'owner'}
                        className={cn(
                          'text-xs font-bold px-2 py-1 rounded-lg border-0 outline-none',
                          style.bg,
                          style.text,
                          member.role === 'owner' && 'cursor-not-allowed',
                        )}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r} className="bg-[#16213e] text-primary">
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-secondary hidden md:table-cell">
                      {formatDate(member.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-secondary hidden lg:table-cell">
                      {member.lastActiveAt ? (
                        formatDate(member.lastActiveAt)
                      ) : (
                        <span className="text-zinc-600">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {member.role !== 'owner' &&
                        (confirmRemove === member.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemove(member.id)}
                              className="px-2 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(null)}
                              className="px-2 py-1 rounded-lg text-xs font-bold text-muted hover:text-primary"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(member.id)}
                            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending Invitations
          </h3>
          <div className="neu-raised rounded-2xl border border-border/50 divide-y divide-white/5">
            {invitations.map((inv) => {
              const style = ROLE_STYLES[inv.role] ?? ROLE_STYLES.viewer;
              return (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted" />
                    <div>
                      <p className="text-sm font-bold text-primary">{inv.email}</p>
                      <span
                        className={cn('text-[10px] font-bold uppercase tracking-wider', style.text)}
                      >
                        {inv.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{formatDate(inv.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => handleRevoke(inv.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
