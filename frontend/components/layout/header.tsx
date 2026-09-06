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
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Breadcrumbs & Titles */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 mb-0.5">
          <span>Workbench</span>
          <ChevronRight className="w-3 h-3 text-zinc-600" />
          <span className="text-zinc-400">{current.section}</span>
          <ChevronRight className="w-3 h-3 text-zinc-600" />
          <span className="text-cyan-400 font-semibold">{current.title}</span>
        </div>
        <p className="text-xs text-zinc-400 hidden sm:block truncate">
          {current.subtitle}
        </p>
      </div>

      {/* Right: Actions, Worker Telemetry & Theme */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Active Worker Heartbeat Badge */}
        {runningCount > 0 ? (
          <Link href="/runtime" title="View Active Worker Threads">
            <Badge variant="active" pulse size="md" className="cursor-pointer font-mono">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>{runningCount} Active {runningCount === 1 ? "Worker" : "Workers"}</span>
            </Badge>
          </Link>
        ) : (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-500 text-xs font-mono">
            <Activity className="w-3 h-3 text-zinc-600" />
            <span>Workers Idle</span>
          </div>
        )}

        {/* Air-gapped health beacon */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
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
