"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  FileText,
  Cpu,
  Activity,
  Settings,
  Shield,
  Radio,
  LogOut,
  User,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

export const NAV_ITEMS = [
  {
    name: "Agents",
    href: "/agents",
    icon: Bot,
    description: "Fleet & Reasoning",
  },
  {
    name: "Knowledge Vault",
    href: "/documents",
    icon: FileText,
    description: "Vector Documents & Ingest",
  },
  {
    name: "Model Hub",
    href: "/models",
    icon: Cpu,
    description: "GGUF & Local Quantizations",
  },
  {
    name: "Model Chat",
    href: "/chat",
    icon: MessageSquare,
    description: "Direct Model Reasoning",
  },
  {
    name: "Runtime",
    href: "/runtime",
    icon: Activity,
    description: "Workers & Server Daemon",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Governance & Identity",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("sidebar:collapsed") === "true";
    }
    return false;
  });

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar:collapsed", String(next));
  };

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-64"
      } bg-white dark:bg-[#0a0a0c] border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none transition-all duration-200 z-30`}
    >
      {/* Top Branding Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-900/90">
        <div className="flex items-center justify-between mb-3">
          <Link href="/agents" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] group-hover:scale-105 transition-transform border border-cyan-400/40 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-1.5">
                  AI Workbench
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono border border-cyan-500/20">
                    v2.4
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Sovereign On-Premise
                </div>
              </div>
            )}
          </Link>

          {/* Collapse Toggle Button */}
          <button
            type="button"
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className="hidden md:flex p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-900 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Persistent Air-Gapped Environment Badge */}
        {!isCollapsed ? (
          <div className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-emerald-500/30 flex flex-col gap-1 shadow-inner backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                  Air-Gapped Node
                </span>
              </div>
              <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400/80" />
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center justify-between">
              <span>Egress: 0.0 KB</span>
              <span className="text-zinc-400 dark:text-zinc-500">127.0.0.1</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Air-Gapped Node // 0.0 KB Egress">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-3 pb-2 text-[10px] font-semibold font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Workspaces
          </div>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 shadow-[0_0_16px_-4px_rgba(6,182,212,0.25)]"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900/60 border border-transparent"
              } ${isCollapsed ? "justify-center px-2" : ""}`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-cyan-500 rounded-r-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              )}
              <div
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                    : "bg-zinc-100 text-zinc-600 group-hover:text-zinc-900 dark:bg-zinc-900/80 dark:text-zinc-400 dark:group-hover:text-zinc-200"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white truncate">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-400 truncate">
                    {item.description}
                  </span>
                </div>
              )}
            </Link>
          );
        })}

        {!isCollapsed && (
          <>
            <div className="pt-4 px-3 pb-2 text-[10px] font-semibold font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              System
            </div>
            <Link
              href="/"
              className="group flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-900/40 border border-transparent"
            >
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                <span>Overview Portal</span>
              </div>
              <Sparkles className="w-3 h-3 text-cyan-600 dark:text-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </Link>
          </>
        )}
      </nav>

      {/* Operator Session Drawer (Bottom) */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-900/90 bg-zinc-50/80 dark:bg-zinc-950/60">
        {drawerOpen && !isCollapsed && (
          <div className="mb-3 p-3 rounded-xl bg-white dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-2 text-xs backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Operator Session
            </div>
            <div className="text-zinc-800 dark:text-zinc-300 truncate font-mono text-[11px]">
              {user?.id ? `ID: ${user.id.slice(0, 16)}...` : "Local Operator"}
            </div>
            <div className="text-zinc-600 dark:text-zinc-400 text-[11px] truncate font-mono">
              {user?.email || "admin@example.com"}
            </div>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <Link
                href="/settings"
                onClick={() => setDrawerOpen(false)}
                className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline font-mono"
              >
                Settings &gt;
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-500 dark:hover:text-rose-300 font-medium cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          title={isCollapsed ? (user?.name || "Operator") : undefined}
          className={`w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900/80 transition-colors cursor-pointer ${
            isCollapsed ? "justify-center p-1.5" : ""
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <User className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 text-left">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {user?.name || "Administrator"}
                </div>
                <div className="text-[10px] text-zinc-500 truncate font-mono">
                  {user?.email || "admin@example.com"}
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <ChevronRight
              className={`w-4 h-4 text-zinc-400 dark:text-zinc-500 transition-transform ${
                drawerOpen ? "-rotate-90" : ""
              }`}
            />
          )}
        </button>
      </div>
    </aside>
  );
}
