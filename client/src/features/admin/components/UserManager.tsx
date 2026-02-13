import { useState, useEffect } from 'react';
import { fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../../api';
import { Users, Plus, Edit2, Trash2, X, Save, Shield } from 'lucide-react';

interface AdminUser {
    id: string;
    username: string;
    email?: string;
    role: string;
    status?: string;
    lastLogin?: string;
    createdAt?: string;
}

export function UserManager() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'viewer' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await fetchAdminUsers();
            setUsers(Array.isArray(res) ? res : res?.users || []);
        } catch { /* */ }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!formData.username || !formData.password) return;
        setSaving(true);
        try {
            await createAdminUser(formData);
            setShowForm(false);
            setFormData({ username: '', email: '', password: '', role: 'viewer' });
            setMessage('User created');
            setTimeout(() => setMessage(''), 3000);
            loadUsers();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Create failed');
        }
        setSaving(false);
    };

    const handleUpdate = async () => {
        if (!editingUser) return;
        setSaving(true);
        try {
            await updateAdminUser(editingUser.id, {
                username: editingUser.username,
                email: editingUser.email,
                role: editingUser.role,
                status: editingUser.status,
            });
            setEditingUser(null);
            setMessage('User updated');
            setTimeout(() => setMessage(''), 3000);
            loadUsers();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Update failed');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string, username: string) => {
        if (!confirm(`Delete user "${username}"?`)) return;
        try {
            await deleteAdminUser(id);
            setMessage('User deleted');
            setTimeout(() => setMessage(''), 3000);
            loadUsers();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    const roleColors: Record<string, string> = {
        super_admin: 'bg-red-500/10 text-red-400',
        admin: 'bg-[#FFCC00]/10 text-[#FFCC00]',
        operator: 'bg-blue-500/10 text-blue-400',
        viewer: 'bg-zinc-500/10 text-zinc-400',
    };

    if (loading) {
        return <div className="space-y-4"><h2 className="text-2xl font-bold text-white">User Manager</h2><div className="animate-pulse h-64 rounded-2xl bg-[#16213e]" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">User Manager</h2>
                    <p className="text-sm text-zinc-500">Manage admin users and roles</p>
                </div>
                <button type="button" onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-[#FFCC00] text-[#1a1a2e] font-bold rounded-lg text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add User
                </button>
            </div>

            {message && (
                <div className={`px-4 py-2 rounded-lg text-sm ${message.includes('failed') || message.includes('Failed') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {message}
                </div>
            )}

            {/* User Table */}
            <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider border-b border-white/5">
                            <th className="pb-3 pr-4">Username</th>
                            <th className="pb-3 pr-4">Email</th>
                            <th className="pb-3 pr-4">Role</th>
                            <th className="pb-3 pr-4">Status</th>
                            <th className="pb-3 pr-4">Last Login</th>
                            <th className="pb-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} className="border-b border-white/5 hover:bg-[#1a1a2e]/50">
                                <td className="py-3 pr-4">
                                    <div className="flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-zinc-500" />
                                        <span className="text-zinc-300 font-medium">{u.username}</span>
                                    </div>
                                </td>
                                <td className="py-3 pr-4 text-zinc-400">{u.email || '-'}</td>
                                <td className="py-3 pr-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${roleColors[u.role] || roleColors.viewer}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="py-3 pr-4">
                                    <span className={`w-2 h-2 inline-block rounded-full mr-1 ${u.status === 'active' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                                    <span className="text-xs text-zinc-400">{u.status || 'active'}</span>
                                </td>
                                <td className="py-3 pr-4 text-xs text-zinc-500">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</td>
                                <td className="py-3">
                                    <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => setEditingUser({ ...u })}
                                            className="p-1.5 rounded-lg text-zinc-400 hover:text-[#FFCC00] hover:bg-[#FFCC00]/5">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button type="button" onClick={() => handleDelete(u.id, u.username)}
                                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/5">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && <p className="text-sm text-zinc-500 mt-4">No users found</p>}
            </div>

            {/* Create Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white">Create User</h3>
                            <button type="button" onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Username *</label>
                                <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50" />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Email</label>
                                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50" />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Password *</label>
                                <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50" />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Role</label>
                                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50">
                                    <option value="viewer">Viewer</option>
                                    <option value="operator">Operator</option>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-6">
                            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-white/10 text-zinc-400 text-sm">Cancel</button>
                            <button type="button" onClick={handleCreate} disabled={saving}
                                className="flex-1 py-2 rounded-lg bg-[#FFCC00] text-[#1a1a2e] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                <Save className="w-4 h-4" /> {saving ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white">Edit User</h3>
                            <button type="button" onClick={() => setEditingUser(null)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Username</label>
                                <input type="text" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50" />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Email</label>
                                <input type="email" value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50" />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Role</label>
                                <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50">
                                    <option value="viewer">Viewer</option>
                                    <option value="operator">Operator</option>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Status</label>
                                <select value={editingUser.status || 'active'} onChange={e => setEditingUser({ ...editingUser, status: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-6">
                            <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-zinc-400 text-sm">Cancel</button>
                            <button type="button" onClick={handleUpdate} disabled={saving}
                                className="flex-1 py-2 rounded-lg bg-[#FFCC00] text-[#1a1a2e] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
