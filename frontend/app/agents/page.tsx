"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bot,
  Plus,
  Trash2,
  Settings,
  ArrowRight,
  Cpu,
  Wrench,
  FileText,
  Search,
} from 'lucide-react';
import { Agent } from '@/lib/api/types';
import { agentsApi } from '@/lib/api/agents';
import { useToast } from '@/context/toast-context';

export default function AgentListPage() {
  const { toast, confirm } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    agentsApi.getAgents()
      .then((data) => {
        if (active) {
          setAgents(data || []);
        }
      })
      .catch((err) => {
        if (active) {
          const detail = err?.response?.data?.detail || 'Failed to fetch agents from backend API.';
          toast.error(detail, 'API Error');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [toast]);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Decommission Agent',
      message: `Are you sure you want to decommission agent "${name}"? This permanently removes the agent from the database.`,
      confirmText: 'Yes, Decommission',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    try {
      await agentsApi.deleteAgent(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
      toast.success(`Agent "${name}" decommissioned successfully.`, 'Agent Decommissioned');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete agent on backend';
      toast.error(msg, 'Delete Failed');
    }
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(search.toLowerCase())) ||
      (a.model && a.model.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents by name, model, or instructions..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        <Link
          href="/agents/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Agent</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 animate-pulse p-6"
            />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800">
          <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-200">No matching agents in backend</h3>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Create an agent to assign tools and start executing diagnostic tasks.
          </p>
          <Link
            href="/agents/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Provision Agent via Backend API
          </Link>
        </div>
      ) : (
        /* Agent Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="group relative flex flex-col justify-between p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200 shadow-sm"
            >
              <div>
                {/* Card Header: Icon & Model Chip */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Bot className="w-5 h-5" />
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                    <Cpu className="w-3 h-3 text-cyan-400" />
                    <span className="truncate max-w-[130px]">{agent.model || agent.ai_model?.name || 'Local GGUF'}</span>
                  </span>
                </div>

                {/* Agent Title & Description */}
                <h3 className="text-base font-bold text-zinc-100 group-hover:text-white transition-colors mb-1.5">
                  {agent.name}
                </h3>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-4">
                  {agent.description || 'No description provided.'}
                </p>

                {/* Tools & Knowledge Badges */}
                <div className="space-y-2 mb-6">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {agent.tools && agent.tools.length > 0 ? (
                      agent.tools.map((tool) => (
                        <span
                          key={tool.id || tool.name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        >
                          <Wrench className="w-2.5 h-2.5" />
                          {tool.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-zinc-600 font-mono">No active tools</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                    <FileText className="w-3 h-3 text-zinc-400" />
                    <span>
                      {agent.documents?.length || 0} Knowledge Document
                      {agent.documents?.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Link
                    href={`/agents/${agent.id}?tab=config`}
                    title="Configure Agent"
                    className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>

                  <button
                    type="button"
                    title="Delete Agent"
                    onClick={() => handleDelete(agent.id, agent.name)}
                    className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Link
                  href={`/agents/${agent.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition-colors"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
