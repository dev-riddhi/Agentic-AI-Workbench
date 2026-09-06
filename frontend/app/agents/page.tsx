"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
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
  Zap,
  Clock,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Agent } from "@/lib/api/types";
import { agentsApi } from "@/lib/api/agents";
import { useToast } from "@/context/toast-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/ui/skeleton";
import { ConfirmModal } from "@/components/ui/modal";

type FilterTab = "all" | "running" | "scheduled" | "manual";

export default function AgentListPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runningAgentIds, setRunningAgentIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Decommission confirmation state
  const [decommissionTarget, setDecommissionTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAgents = async () => {
    setIsRefreshing(true);
    try {
      const [agentList, runningList] = await Promise.all([
        agentsApi.getAgents(),
        agentsApi.getRunningAgents().catch(() => []),
      ]);

      const runningIds = new Set((runningList || []).map((r) => r.id || (r as unknown as { agent_id?: string }).agent_id || ""));
      setRunningAgentIds(runningIds);
      setAgents(agentList || []);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to fetch agents from backend API.";
      toast.error(detail, "API Error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      agentsApi.getAgents(),
      agentsApi.getRunningAgents().catch(() => []),
    ]).then(([agentList, runningList]) => {
      if (!active) return;
      const runningIds = new Set((runningList || []).map((r) => r.id || (r as unknown as { agent_id?: string }).agent_id || ""));
      setRunningAgentIds(runningIds);
      setAgents(agentList || []);
      setIsLoading(false);
    }).catch((err: unknown) => {
      if (!active) return;
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to fetch agents from backend API.";
      toast.error(detail, "API Error");
      setIsLoading(false);
    });

    const interval = setInterval(() => {
      agentsApi
        .getRunningAgents()
        .then((runningList) => {
          if (!active) return;
          const runningIds = new Set((runningList || []).map((r) => r.id || (r as unknown as { agent_id?: string }).agent_id || ""));
          setRunningAgentIds(runningIds);
        })
        .catch(() => {});
    }, 6000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [toast]);

  const handleConfirmDelete = async () => {
    if (!decommissionTarget) return;
    setIsDeleting(true);
    const { id, name } = decommissionTarget;

    try {
      await agentsApi.deleteAgent(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
      toast.success(`Agent "${name}" decommissioned successfully.`, "Agent Removed");
      setDecommissionTarget(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to decommission agent on backend.";
      toast.error(msg, "Decommission Failed");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered & Searched Agents
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      // Tab filter
      const isRunning = agent.is_running || runningAgentIds.has(agent.id);
      if (activeTab === "running" && !isRunning) return false;
      if (activeTab === "scheduled" && agent.trigger !== "schedule") return false;
      if (activeTab === "manual" && agent.trigger === "schedule") return false;

      // Search query
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        agent.name.toLowerCase().includes(q) ||
        (agent.description && agent.description.toLowerCase().includes(q)) ||
        (agent.model && agent.model.toLowerCase().includes(q)) ||
        (agent.tools && agent.tools.some((t) => t.name.toLowerCase().includes(q)))
      );
    });
  }, [agents, runningAgentIds, activeTab, search]);

  const runningCount = agents.filter((a) => a.is_running || runningAgentIds.has(a.id)).length;
  const scheduledCount = agents.filter((a) => a.trigger === "schedule").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span>Configured Fleet</span>
            <Badge variant="cyan" size="sm" className="font-mono">
              {agents.length} Total
            </Badge>
            {runningCount > 0 && (
              <Badge variant="active" pulse size="sm" className="font-mono">
                {runningCount} Active
              </Badge>
            )}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Supervise on-premise autonomous agents and scheduled operational tasks
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadAgents}
            disabled={isRefreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />}
          >
            Sync
          </Button>

          <Link href="/agents/new">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Provision Agent
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60"
            }`}
          >
            <span>All Fleet</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
              {agents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("running")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "running"
                ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span>Running</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
              {runningCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("scheduled")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "scheduled"
                ? "bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60"
            }`}
          >
            <Clock className="w-3 h-3 text-amber-500 dark:text-amber-400" />
            <span>Scheduled</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
              {scheduledCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "manual"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60"
            }`}
          >
            <Zap className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            <span>On-Demand</span>
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter agents, models, tools..."
            className="w-full pl-10 pr-4 py-1.5 rounded-xl bg-white dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
          />
        </div>
      </div>

      {/* Main Grid Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-card border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-4 shadow-inner">
            <Bot className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
            {search ? "No matching agents found" : "No autonomous agents in fleet"}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 mb-6 max-w-sm leading-relaxed">
            {search
              ? "Try adjusting your search query or reset the filter tabs above."
              : "Provision your first autonomous AI agent powered by local GGUF models and enterprise tools."}
          </p>
          <Link href="/agents/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
              Deploy First Agent
            </Button>
          </Link>
        </div>
      ) : (
        /* Agent Fleet Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAgents.map((agent) => {
            const isRunning = agent.is_running || runningAgentIds.has(agent.id);

            return (
              <div
                key={agent.id}
                className="group relative flex flex-col justify-between p-6 rounded-2xl glass-card hover:border-zinc-700/80 transition-all duration-200"
              >
                <div>
                  {/* Card Header: Avatar, Status & Model Chip */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500/15 via-blue-500/15 to-indigo-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform shadow-[0_0_16px_rgba(6,182,212,0.15)]">
                        <Bot className="w-5 h-5" />
                      </div>
                      {isRunning && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-zinc-950" />
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[65%]">
                      {isRunning ? (
                        <Badge variant="active" pulse size="sm">
                          Executing
                        </Badge>
                      ) : (
                        <Badge variant="offline" size="sm">
                          Idle
                        </Badge>
                      )}

                      <Badge variant="model" size="sm" title={agent.model || "GGUF Model"}>
                        <Cpu className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[120px]">
                          {agent.model || agent.ai_model?.name || "Local GGUF"}
                        </span>
                      </Badge>
                    </div>
                  </div>

                  {/* Agent Identity */}
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors mb-1.5 flex items-center gap-2">
                    <span className="truncate">{agent.name}</span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-4">
                    {agent.description || "No description provided."}
                  </p>

                  {/* Trigger Chip & Capabilities */}
                  <div className="space-y-2.5 mb-6">
                    {/* Trigger Schedule Indicator */}
                    <div className="flex items-center gap-1.5 text-xs">
                      {agent.trigger === "schedule" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                          <Clock className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                          <span>{agent.schedule || "Scheduled cron"}</span>
                        </span>
                      ) : agent.trigger === "onetime" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30">
                          <Calendar className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                          <span>One-Time Run</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                          <Zap className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                          <span>On-Demand Manual</span>
                        </span>
                      )}
                    </div>

                    {/* Assigned Tools Badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {agent.tools && agent.tools.length > 0 ? (
                        agent.tools.slice(0, 3).map((tool) => (
                          <span
                            key={tool.id || tool.name}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/25"
                          >
                            <Wrench className="w-2.5 h-2.5" />
                            {tool.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">No active tools</span>
                      )}
                      {agent.tools && agent.tools.length > 3 && (
                        <span className="text-[10px] text-zinc-500 font-mono px-1">
                          +{agent.tools.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Knowledge Documents Count */}
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono pt-1">
                      <FileText className="w-3 h-3 text-zinc-400" />
                      <span>
                        {agent.documents?.length || 0} Knowledge Document
                        {agent.documents?.length === 1 ? "" : "s"} attached
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/agents/${agent.id}?tab=config`}
                      title="Edit Agent Configuration"
                      className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                    </Link>

                    <button
                      type="button"
                      title="Decommission Agent"
                      onClick={() => setDecommissionTarget({ id: agent.id, name: agent.name })}
                      className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <Link href={`/agents/${agent.id}`}>
                    <Button
                      variant="primary"
                      size="sm"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Open Mission HQ
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decommission Confirmation Modal */}
      <ConfirmModal
        isOpen={!!decommissionTarget}
        onClose={() => setDecommissionTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Decommission Autonomous Agent"
        message={`Are you sure you want to decommission agent "${decommissionTarget?.name}"? This action will cancel any active executions and permanently purge the agent configuration from the database.`}
        confirmText="Yes, Decommission"
        cancelText="Cancel"
        danger
        isLoading={isDeleting}
      />
    </div>
  );
}
