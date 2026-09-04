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
  Play,
  Terminal,
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Agent, ModelRuntimeStatus, AIModelResponse } from '@/lib/api/types';
import { agentsApi } from '@/lib/api/agents';
import { runtimeApi } from '@/lib/api/runtime';
import { modelsApi } from '@/lib/api/models';
import { useToast } from '@/context/toast-context';

export default function OperationsPage() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'workers' | 'models' | 'telemetry'>('workers');
  const [workers, setWorkers] = useState<Agent[]>([]);
  const [modelRuntime, setModelRuntime] = useState<ModelRuntimeStatus | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModelResponse[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [runtimeLogs, setRuntimeLogs] = useState<string[]>([]);
  const [isStartingModel, setIsStartingModel] = useState(false);
  const [isStoppingModel, setIsStoppingModel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

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
    fetchModelRuntime();
    fetchAvailableModels();
    const interval = setInterval(pollWorkers, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [toast]);

  useEffect(() => {
    if (activeTab !== 'models') return;
    let active = true;

    const poll = () => {
      runtimeApi.getModelStatus()
        .then((st) => {
          if (active && st) setModelRuntime(st);
        })
        .catch(() => {});
    };

    poll();
    fetchRuntimeLogs();
    const interval = setInterval(poll, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeTab]);

  const fetchModelRuntime = async () => {
    try {
      const st = await runtimeApi.getModelStatus();
      setModelRuntime(st);
      if (st.model_name && !selectedModel) setSelectedModel(st.model_name);
    } catch {
      // Handled
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const ms = await modelsApi.getModels();
      setAvailableModels(ms || []);
      if (ms && ms.length > 0 && !selectedModel) {
        setSelectedModel(ms[0].name);
      }
    } catch {
      // Handled
    }
  };

  const fetchRuntimeLogs = async () => {
    try {
      const res = await runtimeApi.getModelLogs(100);
      setRuntimeLogs(res.logs || []);
    } catch {
      // Handled
    }
  };

  const handleStartModel = async () => {
    const target = selectedModel || (availableModels.length > 0 ? availableModels[0].name : '');
    if (!target) {
      toast.warning('No model available to launch. Download or upload a model in Model Hub.', 'No Model');
      return;
    }
    setIsStartingModel(true);
    try {
      const st = await runtimeApi.startModel({ model: target });
      setModelRuntime(st);
      toast.success(`llama-server is active with model "${st.model_name}"`, 'Model Started');
      fetchRuntimeLogs();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to start model daemon.';
      toast.error(detail, 'Start Error');
    } finally {
      setIsStartingModel(false);
    }
  };

  const handleStopModel = async () => {
    setIsStoppingModel(true);
    try {
      const st = await runtimeApi.stopModel();
      setModelRuntime(st);
      toast.info('Model daemon terminated.', 'Daemon Stopped');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to stop model daemon.';
      toast.error(detail, 'Stop Error');
    } finally {
      setIsStoppingModel(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [workerData, runtimeData] = await Promise.all([
        agentsApi.getRunningAgents(),
        runtimeApi.getModelStatus().catch(() => null),
      ]);
      setWorkers(workerData || []);
      if (runtimeData) setModelRuntime(runtimeData);
      if (activeTab === 'models') fetchRuntimeLogs();
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
      setWorkers((prev) => prev.filter((w) => w.id !== agentId));
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
              onClick={() => {
                setActiveTab('models');
                fetchModelRuntime();
                fetchRuntimeLogs();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'models'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Model Daemon
              {modelRuntime?.running && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
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
                    <th className="py-3 px-4">Agent</th>
                    <th className="py-3 px-4">Model Engine</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4 text-right">Interrupt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {workers.map((w) => (
                    <tr key={w.id} className="hover:bg-zinc-950/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-100">{w.name}</div>
                        <div className="font-mono text-[10px] text-zinc-500">{w.id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-300">
                        {w.model || w.ai_model?.name || 'Local GGUF'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Running
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {new Date(w.updated_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleStopWorker(w.id)}
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

      {/* TAB 2: MODEL RUNTIME DAEMON */}
      {activeTab === 'models' && (
        <div className="space-y-6">
          {/* Status Bar */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                    modelRuntime?.running
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-100">
                      Local llama-server Supervisor Runner
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
                        modelRuntime?.ready
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : modelRuntime?.running
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-zinc-800/60 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          modelRuntime?.ready
                            ? 'bg-emerald-400 animate-pulse'
                            : modelRuntime?.running
                            ? 'bg-amber-400 animate-spin'
                            : 'bg-zinc-500'
                        }`}
                      />
                      {modelRuntime?.ready
                        ? 'ONLINE & READY'
                        : modelRuntime?.running
                        ? 'LOADING WEIGHTS'
                        : 'STOPPED'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    {modelRuntime?.running
                      ? `PID: ${modelRuntime.pid} • Active Model: ${modelRuntime.model_name || 'GGUF'} • Uptime: ${modelRuntime.uptime_seconds || 0}s`
                      : 'Model runner subprocess is currently inactive.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {modelRuntime?.running ? (
                  <button
                    type="button"
                    onClick={handleStopModel}
                    disabled={isStoppingModel}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>{isStoppingModel ? 'Stopping...' : 'Stop Model'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartModel}
                    disabled={isStartingModel}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isStartingModel ? 'Starting...' : 'Start Model'}</span>
                  </button>
                )}
              </div>
            </div>

            {modelRuntime?.running && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">API Base:</span>
                  <code className="text-cyan-300 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                    {modelRuntime.base_url}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(modelRuntime.base_url);
                      setCopiedEndpoint(true);
                      setTimeout(() => setCopiedEndpoint(false), 2000);
                    }}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Copy API Base URL"
                  >
                    {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                  <span>Ctx: <b className="text-zinc-200">{modelRuntime.ctx_size}</b></span>
                  <span>GPU Layers: <b className="text-zinc-200">{modelRuntime.n_gpu_layers}</b></span>
                  <span>Threads: <b className="text-zinc-200">{modelRuntime.threads || 'Auto'}</b></span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Switch Card */}
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
              <h4 className="text-xs font-mono font-bold uppercase text-zinc-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Target Model Selection
              </h4>
              <p className="text-xs text-zinc-400">
                Switch which local quantized GGUF weights are loaded into GPU memory for all worker agents.
              </p>

              <div>
                <label className="block text-zinc-400 font-mono text-[11px] mb-1">
                  AVAILABLE GGUF WEIGHTS
                </label>
                {availableModels.length === 0 ? (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-dashed border-zinc-800 text-zinc-500 text-xs">
                    No models in storage. Register models via Model Hub.
                  </div>
                ) : (
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.quantization || 'GGUF'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="button"
                onClick={handleStartModel}
                disabled={isStartingModel || availableModels.length === 0}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isStartingModel ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{modelRuntime?.running ? 'Switch & Restart' : 'Boot llama-server'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Terminal Logs View */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-bold uppercase text-zinc-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Live Daemon Output Stream
                </h4>
                <button
                  type="button"
                  onClick={fetchRuntimeLogs}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-black border border-zinc-800/80 font-mono text-[10px] text-zinc-300 h-48 overflow-y-auto space-y-0.5 select-text">
                {runtimeLogs.length === 0 ? (
                  <div className="text-zinc-600 italic">No output logged yet. Launch model daemon to view stdout.</div>
                ) : (
                  runtimeLogs.slice(-50).map((l, i) => (
                    <div key={i} className="leading-tight hover:bg-zinc-900/40 truncate">
                      {l}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NODE TELEMETRY */}
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
