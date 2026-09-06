"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import {
  Bot,
  ShieldCheck,
  ArrowRight,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login, demoLogin, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
          ?.detail ||
        "Authentication failed. Please verify credentials or ensure the FastAPI backend is running.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillAdminHint = () => {
    setEmail("admin@example.com");
    setPassword("Password123!");
    setError(null);
  };

  return (
    <div className="relative min-h-screen w-full bg-zinc-100 dark:bg-[#09090b] flex items-center justify-center p-4 selection:bg-cyan-500/30 selection:text-cyan-200 overflow-hidden">
      {/* Background Ambience & Cyber Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card Container with Shake on Error */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          x: error ? [-10, 10, -6, 6, -2, 2, 0] : 0,
        }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md p-8 rounded-2xl glass-card text-zinc-900 dark:text-zinc-100 shadow-2xl border border-zinc-200 dark:border-zinc-700/60"
      >
        {/* Specular Edge Gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_24px_-4px_rgba(6,182,212,0.4)] mb-3 border border-cyan-400/40">
            <Bot className="w-7 h-7" />
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-zinc-950" />
            </span>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            Sovereign AI Workbench
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Air-gapped on-premise operator authentication
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Air-Gapped Node Verified // 0.0 KB Egress</span>
          </div>
        </div>

        {/* Credential Hint Banner */}
        <div className="mb-5 p-3.5 rounded-xl bg-white/80 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/90 text-xs space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 font-semibold font-mono text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              DEFAULT OPERATOR CREDENTIALS
            </span>
            <button
              type="button"
              onClick={fillAdminHint}
              className="inline-flex items-center gap-1 text-[11px] text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 font-medium cursor-pointer transition-colors bg-cyan-500/10 dark:bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-300 dark:border-cyan-500/30 hover:border-cyan-400"
            >
              <span>Auto-Fill</span>
            </button>
          </div>
          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-mono flex items-center justify-between pt-1">
            <span>Email: <code className="text-zinc-900 dark:text-zinc-200 font-semibold">admin@example.com</code></span>
            <span>Password: <code className="text-zinc-900 dark:text-zinc-200 font-semibold">Password123!</code></span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2.5 shadow-sm">
            <span className="text-sm">⚠️</span>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 font-mono tracking-wide">
              OPERATOR EMAIL
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 font-mono tracking-wide">
              PASSPHRASE
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter passphrase"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting || isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full mt-2 cursor-pointer"
          >
            Authenticate Session
          </Button>
        </form>

        {/* Quick Admin Access */}
        <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800/80 text-center space-y-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={demoLogin}
            leftIcon={<Lock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />}
            className="w-full"
          >
            Quick Sign-In as Seeded Administrator
          </Button>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono px-1">
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Gateway: 127.0.0.1:8000
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              Auth: JWT Bearer (30m + Rotation)
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
