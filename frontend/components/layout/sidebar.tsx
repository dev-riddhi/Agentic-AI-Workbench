"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useState } from 'react';

const NAV_ITEMS = [
  {
    name: 'Agents',
    href: '/agents',
    icon: Bot,
    description: 'Workspaces & Reasoning',
  },
  {
    name: 'Knowledge Vault',
    href: '/documents',
    icon: FileText,
    description: 'Vector Documents & Ingest',
  },
  {
    name: 'Model Hub',
    href: '/models',
    icon: Cpu,
    description: 'GGUF & Local Quantizations',
  },
  {
    name: 'Model Chat',
    href: '/chat',
    icon: MessageSquare,
    description: 'Direct Model Reasoning',
  },
  {
    name: 'Runtime',
    href: '/runtime',
    icon: Activity,
    description: 'Agent & Model Status',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Identity & Endpoints',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none">
      {/* Top branding & environment badge */}
      <div className="p-4 border-b border-zinc-900">
        <Link href="/agents" className="flex items-center gap-3 group mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-zinc-100 tracking-tight flex items-center gap-1.5">
              AI Workbench
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/20">
                Sovereign
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              On-Premise Core v2.4
            </div>
          </div>
        </Link>

        {/* Air-Gapped Environment Badge */}
        <div className="px-3 py-2 rounded-xl bg-zinc-900/90 border border-emerald-500/20 flex flex-col gap-1 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium text-emerald-400 font-mono">
                Air-Gapped Node
              </span>
            </div>
            <Shield className="w-3.5 h-3.5 text-emerald-400/80" />
          </div>
          <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between">
            <span>Egress: Strict 0.0 KB</span>
            <span className="text-zinc-500">127.0.0.1</span>
          </div>
        </div>
      </div>

      {/* Main Navigation links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold font-mono uppercase tracking-wider text-zinc-400">
          Core Workspaces
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-zinc-900 text-zinc-400 group-hover:text-zinc-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-zinc-200 group-hover:text-white">
                  {item.name}
                </span>
                <span className="text-[10px] text-zinc-400 group-hover:text-zinc-400">
                  {item.description}
                </span>
              </div>
            </Link>
          );
        })}

        <div className="pt-4 px-3 pb-2 text-[10px] font-semibold font-mono uppercase tracking-wider text-zinc-400">
          System Docs
        </div>
        <Link
          href="/"
          className="group flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 border border-transparent"
        >
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-zinc-400" />
            <span>Showcase Overview</span>
          </div>
          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </nav>

      {/* User Status Drawer (Bottom) */}
      <div className="p-3 border-t border-zinc-900 bg-zinc-950/80">
        {drawerOpen && (
          <div className="mb-3 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2 text-xs animate-in fade-in slide-in-from-bottom-2">
            <div className="text-[10px] font-mono text-zinc-400 uppercase">
              Identity Session
            </div>
            <div className="text-zinc-300 truncate font-mono text-[11px]">
              ID: {user?.id.slice(0, 18)}...
            </div>
            <div className="text-zinc-400 text-[11px] truncate">
              {user?.email}
            </div>
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <Link
                href="/settings"
                className="text-[11px] text-cyan-400 hover:underline"
              >
                Account Settings
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-medium"
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
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-900 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-zinc-200 truncate">
                {user?.name || 'Operator'}
              </div>
              <div className="text-[10px] text-zinc-400 truncate">
                {user?.email || 'operator@local'}
              </div>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-zinc-400 transition-transform ${
              drawerOpen ? '-rotate-90' : ''
            }`}
          />
        </button>
      </div>
    </aside>
  );
}
