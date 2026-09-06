"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronRight, Activity, ShieldCheck, Zap } from "lucide-react";
import { ThemeToggle } from "../theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { agentsApi } from "@/lib/api/agents";

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

        <ThemeToggle />
      </div>
    </header>
  );
}
