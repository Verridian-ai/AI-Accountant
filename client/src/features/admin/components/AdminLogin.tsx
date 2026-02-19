import { useState } from 'react';
import { adminLogin } from '../../../api';
import { Lock, User, AlertCircle } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (token: string, user: { username: string; role: string }) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminLogin(username, password);
      localStorage.setItem('admin_token', res.token);
      if (res.refreshToken) localStorage.setItem('admin_refresh_token', res.refreshToken);
      onLogin(res.token, {
        username: res.user?.username || username,
        role: res.user?.role || 'admin',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] mb-4">
            <Lock className="w-8 h-8 text-[#FFCC00]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Console</h1>
          <p className="text-sm text-zinc-500 mt-1">GoldLedger Administration</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-8 space-y-6"
        >
          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="login-username"
              className="block text-sm font-medium text-zinc-400 mb-2"
            >
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFCC00]/50 focus:ring-1 focus:ring-[#FFCC00]/30"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-zinc-400 mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFCC00]/50 focus:ring-1 focus:ring-[#FFCC00]/30"
                placeholder="Enter password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#FFCC00] text-[#1a1a2e] font-bold rounded-xl hover:bg-[#FFD633] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Protected area. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
