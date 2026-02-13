import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employment_type: string;
  employment_status: string;
  start_date: string;
  position?: string;
}

interface EmployeeListProps {
  employees: Employee[];
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Active' },
  terminated: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Terminated' },
  on_leave: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'On Leave' },
};

const typeLabels: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  casual: 'Casual',
  contractor: 'Contractor',
};

const PAGE_SIZE = 10;

export function EmployeeList({ employees, loading, onSelect, onRefresh }: EmployeeListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = employees;

    if (statusFilter !== 'all') {
      result = result.filter((e) => e.employment_status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.first_name.toLowerCase().includes(q) ||
          e.last_name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q)
      );
    }

    return result;
  }, [employees, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEmployees = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-white/5 rounded" />
              <div className="h-3 w-24 bg-white/5 rounded" />
            </div>
            <div className="h-6 w-16 bg-white/5 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="neu-raised rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="pl-9 pr-8 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="terminated">Terminated</option>
            <option value="on_leave">On Leave</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                Employee
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                Type
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                Position
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                Start Date
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {pageEmployees.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-zinc-500 text-sm">
                  {search || statusFilter !== 'all'
                    ? 'No employees match your filters'
                    : 'No employees yet. Add your first employee to get started.'}
                </td>
              </tr>
            ) : (
              pageEmployees.map((emp) => {
                const status = statusStyles[emp.employment_status] ?? statusStyles.active;
                return (
                  <tr
                    key={emp.id}
                    onClick={() => onSelect(emp.id)}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#FFCC00]/10 flex items-center justify-center text-sm font-bold text-[#FFCC00]">
                          {emp.first_name[0]}
                          {emp.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {emp.first_name} {emp.last_name}
                          </p>
                          <p className="text-xs text-zinc-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs font-medium text-zinc-300 bg-white/5 px-2 py-1 rounded-md">
                        {typeLabels[emp.employment_type] ?? emp.employment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-zinc-400">{emp.position ?? '-'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-zinc-400">
                        {new Date(emp.start_date).toLocaleDateString('en-AU')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <p className="text-xs text-zinc-500">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1.5 text-xs font-medium text-zinc-400">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
