"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  ChevronRight,
  Activity,
  ShieldCheck,
  Zap,
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { ThemeToggle } from "../theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { agentsApi } from "@/lib/api/agents";
import { useNotifications } from "@/context/notification-context";

const TITLES: Record<string, { section: string; title: string; subtitle: string }> = {
  "/agents": {
    section: "Fleet",
    title: "Agent Fleet & Workspaces",
    subtitle: "Manage autonomous agents configured with local GGUF models",
  },
  "/agents/new": {
    section: "Wizard",
    title: "Provision Agent",
    subtitle: "Configure local model, system instructions, and tool capabilities",
  },
  "/documents": {
    section: "Knowledge",
    title: "Knowledge Vault",
    subtitle: "Upload, index, and inspect enterprise documents for vector RAG",
  },
  "/models": {
    section: "Models",
    title: "Local Model Hub",
    subtitle: "Manage downloaded GGUF quantizations and Hugging Face imports",
  },
  "/chat": {
    section: "Studio",
    title: "Model Chat & Inference",
    subtitle: "Converse directly with loaded local GGUF models and test prompt reasoning",
  },
  "/runtime": {
    section: "Diagnostics",
    title: "Runtime Status & Diagnostics",
    subtitle: "Inspect agent runtime workers and local model runtime daemon",
  },
  "/operations": {
    section: "Diagnostics",
    title: "Runtime Status & Diagnostics",
    subtitle: "Inspect agent runtime workers and local model runtime daemon",
  },
  "/settings": {
    section: "Governance",
    title: "Workbench Settings",
    subtitle: "Identity profile, administrative users, and local API gateway targets",
  },
};

export function Header() {
  const pathname = usePathname();
  const [runningCount, setRunningCount] = useState<number>(0);
  const { notifications, unreadCount, markAllAsRead, markAsRead, clearNotifications, isConnected } = useNotifications();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close notification popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node)
      ) {
        setIsNotificationOpen(false);
      }
    };
    if (isNotificationOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isNotificationOpen]);

  // Poll active running workers every 8 seconds
  useEffect(() => {
    let active = true;

    const checkRunning = () => {
      agentsApi
        .getRunningAgents()
        .then((agents) => {
          if (active && Array.isArray(agents)) {
            setRunningCount(agents.length);
          }
        })
        .catch(() => {
          // Ignore transient poll errors
        });
    };

    checkRunning();
    const interval = setInterval(checkRunning, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Look up matching title or provide default
  let current = TITLES[pathname];
  if (!current && pathname.startsWith("/agents/")) {
    current = {
      section: "Mission",
      title: "Agent Mission Console",
      subtitle: "Execution reasoning, tool traces, inline configuration, and audit logs",
    };
  }
  if (!current) {
    current = {
      section: "Workbench",
      title: "Sovereign Operations",
      subtitle: "On-premise autonomous agentic operations",
    };
  }

  return (
    <header className="h-16 min-h-[64px] max-h-16 shrink-0 w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 select-none transition-colors duration-150">
      {/* Left: Breadcrumbs & Titles */}
      <div className="flex flex-col justify-center min-w-0 pr-4 overflow-hidden">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-0.5 whitespace-nowrap overflow-hidden">
          <span className="shrink-0">Workbench</span>
          <ChevronRight className="w-3 h-3 text-zinc-400 dark:text-zinc-600 shrink-0" />
          <span className="text-zinc-700 dark:text-zinc-300 shrink-0">{current.section}</span>
          <ChevronRight className="w-3 h-3 text-zinc-400 dark:text-zinc-600 shrink-0" />
          <span className="text-cyan-600 dark:text-cyan-400 font-semibold truncate">{current.title}</span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block truncate max-w-xl">
          {current.subtitle}
        </p>
      </div>

      {/* Right: Actions, Worker Telemetry & Theme */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Active Worker Heartbeat Badge */}
        {runningCount > 0 ? (
          <Link href="/runtime" title="View Active Worker Threads">
            <Badge variant="active" pulse size="md" className="cursor-pointer font-mono">
              <Zap className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
              <span>{runningCount} Active {runningCount === 1 ? "Worker" : "Workers"}</span>
            </Badge>
          </Link>
        ) : (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-mono">
            <Activity className="w-3 h-3 text-zinc-400 dark:text-zinc-600" />
            <span>Workers Idle</span>
          </div>
        )}

        {/* Air-gapped health beacon */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Loopback: 8000</span>
        </div>

        {/* Create Agent Action */}
        {pathname !== "/agents/new" && !pathname.includes("/agents/") && (
          <Link href="/agents/new">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Create Agent
            </Button>
          </Link>
        )}

        {/* Notification Center Popover */}
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => setIsNotificationOpen((prev) => !prev)}
            className="relative p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            title="System & Agent Notifications"
            aria-label="System & Agent Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-zinc-950 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            {unreadCount === 0 && isConnected && (
              <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
            )}
          </button>

          {/* Floating Dropdown Card */}
          {isNotificationOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
              <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllAsRead()}
                      className="p-1 text-zinc-400 hover:text-cyan-400 rounded hover:bg-zinc-800 text-[11px] transition-colors cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearNotifications()}
                      className="p-1 text-zinc-500 hover:text-rose-400 rounded hover:bg-zinc-800 text-[11px] transition-colors cursor-pointer"
                      title="Clear notifications"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60 font-sans">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs">
                    <Bell className="w-6 h-6 mx-auto mb-2 text-zinc-600 opacity-50" />
                    <p className="font-medium text-zinc-400">No notifications</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Agents dispatch real-time alerts here via <code className="text-cyan-400 font-mono">system_notification</code>
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const isSuccess = n.type === "success";
                    const isError = n.type === "error";
                    const isWarning = n.type === "warning";

                    return (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 text-xs transition-colors flex items-start gap-2.5 cursor-pointer ${
                          n.read
                            ? "bg-transparent hover:bg-zinc-800/40 text-zinc-400"
                            : "bg-cyan-950/15 hover:bg-cyan-950/25 text-zinc-200"
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          {isError && <AlertCircle className="w-4 h-4 text-rose-400" />}
                          {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                          {n.type === "info" && <Info className="w-4 h-4 text-cyan-400" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-semibold text-zinc-100 text-xs truncate">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed line-clamp-2 text-zinc-300">
                            {n.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
