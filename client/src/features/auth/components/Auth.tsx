import React, { useState } from 'react';
import { api } from '@/api';
import { User, Lock, Loader2, ArrowRight, UserPlus, LogIn, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthProps {
  onLogin: (
    token: string,
    user: { id: string; username: string },
    tenantId?: string | null,
  ) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = isLogin
        ? await api.login(username, password)
        : await api.register(username, password);

      const tenantId = data.activeTenant?.tenantId ?? data.activeTenant?.id ?? null;
      onLogin(data.token, data.user, tenantId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFCC00]/10 rounded-full blur-[128px] animate-breathe" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#FFCC00]/5 rounded-full blur-[100px] animate-breathe animate-delay-2s" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="relative group mb-4">
            {/* Subtle glow ring */}
            <div className="absolute -inset-2 rounded-3xl blur-md opacity-30 group-hover:opacity-45 transition-opacity bg-[#FFCC00]/25" />
            <div className="relative neu-raised p-1 rounded-2xl flex items-center justify-center overflow-hidden">
              <img
                src="/cba-logo.svg"
                alt="GoldLedger"
                className="h-20 w-20 object-cover rounded-xl drop-shadow-[0_0_12px_rgba(255,204,0,0.5)]"
              />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gradient-gold">
            GoldLedger
          </h1>
          <p className="text-zinc-500 font-medium mt-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#FFCC00]" />
            AI-Powered Financial Intelligence
          </p>
        </div>

        {/* Auth Card - Neumorphic Glass */}
        <div className="neu-raised rounded-3xl p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
          {/* Card gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

          {/* Tab Switcher - Neumorphic Inset */}
          <div className="relative neu-inset flex gap-2 mb-8 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={cn(
                'flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300',
                isLogin
                  ? 'neu-raised-sm text-[#FFCC00] cba-gold-glow'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={cn(
                'flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300',
                !isLogin
                  ? 'neu-raised-sm text-[#FFCC00] cba-gold-glow'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative">
            {/* Username Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] ml-1">
                Username
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-600 group-focus-within:text-[#FFCC00] transition-colors" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 neu-inset rounded-xl focus-gold transition-all outline-none text-[#FFCC00] placeholder-zinc-600 font-medium"
                  placeholder="Enter username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-600 group-focus-within:text-[#FFCC00] transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 neu-inset rounded-xl focus-gold transition-all outline-none text-[#FFCC00] placeholder-zinc-600 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 neu-inset rounded-xl border border-red-500/30 text-red-400 text-sm font-medium animate-in fade-in slide-in-from-left-2 glow-danger">
                {error}
              </div>
            )}

            {/* Submit Button - CBA Gold */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 cba-gold-gradient hover:brightness-105 text-[#0a0a0f] rounded-xl font-black text-base shadow-lg cba-gold-glow btn-press disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Link */}
          <div className="mt-8 text-center text-sm text-zinc-500">
            {isLogin ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-[#FFCC00] font-bold hover:brightness-110 transition-all"
                >
                  Register now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-[#FFCC00] font-bold hover:brightness-110 transition-all"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-semibold">
            © 2026 GoldLedger
          </p>
          <div className="mt-3 flex justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full cba-gold-bg opacity-40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
