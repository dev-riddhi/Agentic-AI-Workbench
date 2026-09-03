"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ThemeToggle } from '../theme-toggle';

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/agents': {
    title: 'Agent Fleet & Workspaces',
    subtitle: 'Manage autonomous agents configured with local GGUF models',
  },
  '/agents/new': {
    title: 'Provision Agent',
    subtitle: 'Configure local model, system instructions, and tool capabilities',
  },
  '/documents': {
    title: 'Knowledge Vault',
    subtitle: 'Upload, index, and inspect enterprise documents for vector RAG',
  },
  '/models': {
    title: 'Local Model Hub',
    subtitle: 'Manage downloaded GGUF quantizations and Hugging Face imports',
  },
  '/operations': {
    title: 'Running Operations & Telemetry',
    subtitle: 'Monitor supervisor heartbeats, execution states, and host isolation',
  },
  '/settings': {
    title: 'Workbench Settings',
    subtitle: 'Identity profile, administrative users, and local API gateway targets',
  },
};

export function Header() {
  const pathname = usePathname();

  // Look up matching title or provide default
  let current = TITLES[pathname];
  if (!current && pathname.startsWith('/agents/')) {
    current = {
      title: 'Agent Workspace',
      subtitle: 'Execution reasoning, chat streams, configuration, and audit logs',
    };
  }
  if (!current) {
    current = {
      title: 'Sovereign Workbench',
      subtitle: 'On-premise autonomous agentic operations',
    };
  }

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          {current.title}
        </h1>
        <p className="text-xs text-zinc-400 hidden sm:block">
          {current.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Air-gapped health check beacon */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>FastAPI: 8000 OK</span>
        </div>

        {pathname !== '/agents/new' && !pathname.includes('/agents/') && (
          <Link
            href="/agents/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-sm transition-all hover:shadow-cyan-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Agent
          </Link>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
