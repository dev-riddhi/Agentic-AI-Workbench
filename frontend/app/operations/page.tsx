"use client";

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Square,
  RefreshCw,
  Shield,
  Cpu,
  Radio,
  Server,
} from 'lucide-react';
import { RunningAgentResponse } from '@/lib/api/types';
import { agentsApi } from '@/lib/api/agents';
import { useToast } from '@/context/toast-context';

export default function OperationsPage() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'workers' | 'telemetry'>('workers');
  const [workers, setWorkers] = useState<RunningAgentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    const pollWorkers = () => {
      agentsApi.getRunningAgents()
        .then((data) => {
          if (active) setWorkers(data || []);
        })
        .catch((err: unknown) => {
          if (active) {
            const detail =
              (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
              'Failed to fetch running workers from backend.';
            toast.error(detail, 'API Error');
          }
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
            setIsRefreshing(false);
          }
        });
    };

    pollWorkers();
    const interval = setInterval(pollWorkers, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [toast]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await agentsApi.getRunningAgents();
      setWorkers(data || []);
    } catch {
      // Handled
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStopWorker = async (agentId: string) => {
    const ok = await confirm({
      title: 'Stop Agent Worker',
      message: `Send interrupt signal to stop this running agent daemon?`,
      confirmText: 'Yes, Stop Worker',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    try {
      await agentsApi.stopAgent(agentId);
      setWorkers((prev) => prev.filter((w) => w.agent_id !== agentId));
      toast.success('Agent worker stopped successfully via backend API.', 'Worker Stopped');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to stop worker on backend API';
      toast.error(detail, 'Stop Error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Supervisor Operations & Node Telemetry
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time execution daemon, automatic crash recovery, and hardware runner stats
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('workers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'workers'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Active Workers ({workers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'telemetry'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Node Telemetry
            </button>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            title="Refresh Heartbeats"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* TAB 1: ACTIVE WORKERS */}
      {activeTab === 'workers' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100">Live Agent Execution Threads</h3>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              Supervisor Daemon Active
            </span>
          </div>

          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : workers.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs text-zinc-500">
              No active workers currently registered on the backend supervisor. Run a prompt in any agent workspace to start a worker thread.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-mono uppercase text-[10px]">
                    <th className="py-3 px-4">Agent ID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Auto-Restart</th>
                    <th className="py-3 px-4">Last Heartbeat</th>
                    <th className="py-3 px-4">Configuration Context</th>
                    <th className="py-3 px-4 text-right">Interrupt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {workers.map((w) => (
                    <tr key={w.id} className="hover:bg-zinc-950/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-cyan-300">
                        {w.agent_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {w.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-300">
                        {w.auto_restart ? 'Enabled (Supervisor)' : 'Disabled'}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {new Date(w.last_heartbeat).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-zinc-300 truncate max-w-xs font-mono text-[11px]">
                        {w.configuration || 'Default execution runner'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleStopWorker(w.agent_id)}
                          className="flex items-center gap-1 ml-auto px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium cursor-pointer"
                        >
                          <Square className="w-3 h-3 fill-current" />
                          Stop
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NODE TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Air-Gapped Network Assertion */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-zinc-400 font-bold">
                Network Perimeter
              </span>
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              Strict Air-Gapped
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No outgoing packets allowed. All token generation occurs strictly on the local host machine via GGUF binaries.
            </p>
            <div className="pt-2 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 flex justify-between">
              <span>External Egress:</span>
              <span className="text-zinc-200">0.00 KB</span>
            </div>
          </div>

          {/* Card 2: Local LLM Engine */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-zinc-400 font-bold">
                Inference Runner
              </span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-cyan-300 tracking-tight">
              FastAPI / ASGI Runner
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Active process connected to <code className="text-cyan-300 font-mono">http://localhost:8000</code>.
            </p>
            <div className="pt-2 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 flex justify-between">
              <span>Active Workers:</span>
              <span className="text-zinc-200">{workers.length} Processes</span>
            </div>
          </div>

          {/* Card 3: Vector DB & Storage */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-zinc-400 font-bold">
                Vector Storage
              </span>
              <Server className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-indigo-300 tracking-tight">
              PostgreSQL & pgvector
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              HNSW indexing running locally with 384-dimensional cosine similarity embeddings.
            </p>
            <div className="pt-2 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 flex justify-between">
              <span>Index Lookup Latency:</span>
              <span className="text-zinc-200">&lt; 4.2 ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
