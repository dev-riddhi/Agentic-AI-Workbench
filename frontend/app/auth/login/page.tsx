"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Bot, Shield, ArrowRight, Lock, Mail, KeyRound, Info, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { login, demoLogin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Authentication failed. Please verify credentials or ensure the FastAPI backend is running.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillAdminHint = () => {
    setEmail('admin@example.com');
    setPassword('admin');
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
      {/* Brand & Badge */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 mb-3">
          <Bot className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
          Sovereign AI Workbench
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Air-gapped on-premise authentication portal
        </p>

        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Shield className="w-3.5 h-3.5" />
          <span>Local Perimeter Protected</span>
        </div>
      </div>

      {/* Credential Hint Banner */}
      <div className="mb-5 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-cyan-400 font-semibold font-mono text-[11px]">
            <Info className="w-3.5 h-3.5" />
            BACKEND AUTHENTICATION CREDENTIALS
          </span>
          <button
            type="button"
            onClick={fillAdminHint}
            className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span>Use hint</span>
          </button>
        </div>
        <div className="text-[11px] text-zinc-400 leading-relaxed font-mono space-y-0.5">
          <div>Email: <code className="text-zinc-200 font-bold">admin@example.com</code></div>
          <div>Passphrase: <code className="text-zinc-200 font-bold">admin</code></div>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
            OPERATOR EMAIL
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@example.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
            PASSPHRASE
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter passphrase"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Authenticate Session</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Quick Demo Button */}
      <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
        <button
          type="button"
          onClick={demoLogin}
          className="w-full py-2 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Lock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Quick Login as Administrator</span>
        </button>
        <p className="text-[11px] text-zinc-500 mt-3 font-mono">
          FastAPI Gateway: <code className="text-zinc-400">http://localhost:8000/api/v1</code>
        </p>
      </div>
    </div>
  );
}
