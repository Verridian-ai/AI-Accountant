import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Search,
  Ban,
  Trash2,
  MoreVertical,
  Mail,
  Calendar,
  Shield,
  ShieldCheck,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// Types
export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'pending';
  createdAt: string;
  lastLoginAt?: string;
  transactionCount: number;
  statementCount: number;
  subscriptionPlan?: string;
}

interface UserManagementProps {
  onViewUser?: (userId: string) => void;
  onSuspendUser?: (userId: string) => Promise<void>;
  onDeleteUser?: (userId: string) => Promise<void>;
  onExportUsers?: (format: 'csv' | 'json') => void;
  className?: string;
}

// Mock data for demonstration
const mockUsers: User[] = [
  {
    id: '1',
    username: 'john.doe',
    email: 'john@example.com',
    role: 'user',
    status: 'active',
    createdAt: '2024-01-15T10:30:00Z',
    lastLoginAt: '2024-01-28T08:45:00Z',
    transactionCount: 245,
    statementCount: 12,
    subscriptionPlan: 'pro',
  },
  {
    id: '2',
    username: 'jane.smith',
    email: 'jane@example.com',
    role: 'admin',
    status: 'active',
    createdAt: '2023-11-20T14:20:00Z',
    lastLoginAt: '2024-01-27T16:30:00Z',
    transactionCount: 567,
    statementCount: 24,
    subscriptionPlan: 'enterprise',
  },
  {
    id: '3',
    username: 'bob.wilson',
    email: 'bob@example.com',
    role: 'user',
    status: 'suspended',
    createdAt: '2024-01-05T09:15:00Z',
    transactionCount: 0,
    statementCount: 0,
    subscriptionPlan: 'free',
  },
];

export function UserManagement({
  onViewUser,
  onSuspendUser,
  onDeleteUser,
  onExportUsers,
  className,
}: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 10;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        actionMenuOpen &&
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setActionMenuOpen(null);
      }
    };

    // Close on Escape key
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && actionMenuOpen) {
        setActionMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [actionMenuOpen]);

  // Simulated fetch
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // In production, this would be an API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filtering
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleSelectAll = () => {
    if (selectedUsers.size === paginatedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(paginatedUsers.map((u) => u.id)));
    }
  };

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSuspendUser = async (userId: string) => {
    setProcessingAction(userId);
    try {
      await onSuspendUser?.(userId);
      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, status: u.status === 'suspended' ? 'active' : 'suspended' } : u,
        ),
      );
    } finally {
      setProcessingAction(null);
      setActionMenuOpen(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setProcessingAction(userId);
    try {
      await onDeleteUser?.(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } finally {
      setProcessingAction(null);
      setActionMenuOpen(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getRoleBadge = (role: User['role']) => {
    switch (role) {
      case 'super_admin':
        return (
          <Badge variant="default" className="gap-1">
            <ShieldCheck className="w-3 h-3" />
            Super Admin
          </Badge>
        );
      case 'admin':
        return (
          <Badge variant="secondary" className="gap-1">
            <Shield className="w-3 h-3" />
            Admin
          </Badge>
        );
      default:
        return <Badge variant="outline">User</Badge>;
    }
  };

  const getStatusBadge = (status: User['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  if (loading) {
    return <UserManagementSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        'neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5',
        className,
      )}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.03),transparent)] pointer-events-none" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="neu-inset p-3 rounded-xl border border-white/5">
            <Users className="w-5 h-5 text-[#FFCC00]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-100">User Management</h3>
            <p className="text-xs text-zinc-500">{filteredUsers.length} users total</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExportUsers?.('csv')}
            className="gap-1"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchUsers}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="relative flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 rounded-xl"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div className="relative flex items-center gap-3 p-3 mb-4 rounded-xl bg-[#FFCC00]/10 border border-[#FFCC00]/20">
          <span className="text-sm text-[#FFCC00]">{selectedUsers.size} user(s) selected</span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedUsers(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* User List */}
      <div className="relative space-y-2">
        {/* Header Row */}
        <div className="hidden sm:grid grid-cols-[auto_1fr_120px_100px_100px_80px] gap-4 px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          <div className="w-5">
            <input
              type="checkbox"
              checked={selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0}
              onChange={handleSelectAll}
              className="rounded border-zinc-600 bg-white/5 text-[#FFCC00] focus:ring-[#FFCC00]/20"
              aria-label="Select all users on this page"
            />
          </div>
          <div>User</div>
          <div>Status</div>
          <div>Statements</div>
          <div>Last Login</div>
          <div>Actions</div>
        </div>

        {/* User Rows */}
        {paginatedUsers.map((user) => (
          <div
            key={user.id}
            className={cn(
              'group grid grid-cols-1 sm:grid-cols-[auto_1fr_120px_100px_100px_80px] gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 transition-all hover:bg-white/[0.04] hover:border-white/10',
              selectedUsers.has(user.id) && 'bg-[#FFCC00]/5 border-[#FFCC00]/20',
            )}
          >
            {/* Checkbox */}
            <div className="hidden sm:flex items-center">
              <input
                type="checkbox"
                checked={selectedUsers.has(user.id)}
                onChange={() => handleSelectUser(user.id)}
                className="rounded border-zinc-600 bg-white/5 text-[#FFCC00] focus:ring-[#FFCC00]/20"
                aria-label={`Select user ${user.username}`}
              />
            </div>

            {/* User Info */}
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => onViewUser?.(user.id)}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFCC00]/20 to-[#FFCC00]/5 flex items-center justify-center text-[#FFCC00] font-bold text-sm">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-zinc-100 truncate">{user.username}</p>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{user.email || 'No email'}</span>
                </div>
              </div>
            </div>

            {/* Status & Role */}
            <div className="flex flex-wrap items-center gap-2 sm:justify-start">
              {getStatusBadge(user.status)}
              {getRoleBadge(user.role)}
            </div>

            {/* Stats */}
            <div className="text-sm text-zinc-400">
              <span className="sm:hidden text-xs text-zinc-500">Statements: </span>
              {user.statementCount}
            </div>

            {/* Last Login */}
            <div className="flex items-center gap-1.5 text-sm text-zinc-400">
              <Calendar className="w-3 h-3 sm:hidden" />
              {formatDate(user.lastLoginAt)}
            </div>

            {/* Actions */}
            <div
              className="relative flex justify-end"
              ref={actionMenuOpen === user.id ? actionMenuRef : undefined}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                disabled={processingAction === user.id}
                aria-label={`Actions for ${user.username}`}
                aria-expanded={actionMenuOpen === user.id}
                aria-haspopup="menu"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>

              {actionMenuOpen === user.id && (
                <div
                  className="absolute right-0 top-full mt-1 z-10 w-48 rounded-xl bg-[#16161f] border border-white/10 shadow-xl overflow-hidden"
                  role="menu"
                  aria-label="User actions"
                >
                  <button
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-2 text-zinc-300"
                    onClick={() => onViewUser?.(user.id)}
                    role="menuitem"
                  >
                    <Users className="w-4 h-4" />
                    View Details
                  </button>
                  <button
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-2 text-amber-400"
                    onClick={() => handleSuspendUser(user.id)}
                    role="menuitem"
                  >
                    <Ban className="w-4 h-4" />
                    {user.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                  </button>
                  <button
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-2 text-red-400"
                    onClick={() => handleDeleteUser(user.id)}
                    role="menuitem"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete User
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {paginatedUsers.length === 0 && (
          <div className="py-12 text-center text-zinc-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No users found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="relative flex items-center justify-between mt-6 pt-4 border-t border-white/5">
          <p className="text-sm text-zinc-500">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-zinc-400">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserManagementSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-32 h-5 rounded" />
            <Skeleton className="w-20 h-3 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-20 h-8 rounded-lg" />
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-3 mb-6">
        <Skeleton className="flex-1 h-10 rounded-xl" />
        <Skeleton className="w-[140px] h-10 rounded-xl" />
        <Skeleton className="w-[140px] h-10 rounded-xl" />
      </div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="w-full h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
