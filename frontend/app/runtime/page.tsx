"use client";

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  RefreshCw,
  Server,
  Play,
  Square,
  Terminal,
  Zap,
  Copy,
  Check,
  Power,
  Send,
  Shield,
  Bot,
} from 'lucide-react';
import {
  ActiveAgentRuntimeItem,
  AIModelResponse,
  ModelRuntimeStatus,
  RuntimeOverviewResponse,
} from '@/lib/api/types';
import { runtimeApi } from '@/lib/api/runtime';
import { modelsApi } from '@/lib/api/models';
import { useToast } from '@/context/toast-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function RuntimePage() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'agent' | 'model'>('agent');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Overview & Agent Runtime state
  const [overview, setOverview] = useState<RuntimeOverviewResponse | null>(null);
  const [activeAgents, setActiveAgents] = useState<ActiveAgentRuntimeItem[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isStoppingAgentId, setIsStoppingAgentId] = useState<string | null>(null);

  // Model Runtime state
  const [modelRuntime, setModelRuntime] = useState<ModelRuntimeStatus | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModelResponse[]>([]);
  const [selectedRuntimeModel, setSelectedRuntimeModel] = useState<string>('');
  const [runtimePort, setRuntimePort] = useState<number>(8080);
  const [runtimeCtxSize, setRuntimeCtxSize] = useState<number>(4096);
  const [runtimeGpuLayers, setRuntimeGpuLayers] = useState<number>(99);
  const [isStartingRuntime, setIsStartingRuntime] = useState(false);
  const [isStoppingRuntime, setIsStoppingRuntime] = useState(false);
  const [runtimeLogs, setRuntimeLogs] = useState<string[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  // Inference Diagnostic state
  const [testPrompt, setTestPrompt] = useState('Explain sovereign agentic AI in two sentences.');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [isTestingModel, setIsTestingModel] = useState(false);

  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setIsFetchingLogs(true);
    try {
      const res = await runtimeApi.getModelLogs(150);
      setRuntimeLogs(res.logs || []);
    } catch {
      // Handled
    } finally {
      if (showLoading) setIsFetchingLogs(false);
    }
  };

  // Initial load
  useEffect(() => {
    let active = true;

    const loadAll = async () => {
      try {
        const [ov, models] = await Promise.allSettled([
          runtimeApi.getOverview(),
          modelsApi.getModels(),
        ]);

        if (active && ov.status === 'fulfilled' && ov.value) {
          setOverview(ov.value);
          setModelRuntime(ov.value.model_runtime);
          setActiveAgents(ov.value.active_agents || []);
          if (ov.value.model_runtime.model_name) {
            const runningName = ov.value.model_runtime.model_name;
            setSelectedRuntimeModel((prev) => prev || runningName);
          }
        }

        if (active && models.status === 'fulfilled' && models.value) {
          setAvailableModels(models.value);
          if (models.value.length > 0) {
            setSelectedRuntimeModel((prev) => prev || (models.value[0]?.name ?? ''));
          }
        }

        // Initial logs
        const logsRes = await runtimeApi.getModelLogs(150).catch(() => null);
        if (active && logsRes?.logs) {
          setRuntimeLogs(logsRes.logs);
        }
      } finally {
        if (active) setIsLoadingAgents(false);
      }
    };

    loadAll();

    // Regular polling ticker for active workers
    const interval = setInterval(() => {
      runtimeApi.getActiveAgents()
        .then((agents) => {
          if (active) setActiveAgents(agents || []);
        })
        .catch(() => {});

      runtimeApi.getModelStatus()
        .then((st) => {
          if (active && st) setModelRuntime(st);
        })
        .catch(() => {});
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const refreshOverview = async () => {
    setIsRefreshing(true);
    try {
      const ov = await runtimeApi.getOverview();
      setOverview(ov);
      setModelRuntime(ov.model_runtime);
      setActiveAgents(ov.active_agents || []);
      toast.success('Runtime status synchronized.', 'Status Refreshed');
    } catch {
      toast.error('Failed to sync runtime status with backend.', 'Sync Failed');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStartRuntime = async () => {
    const targetModel = selectedRuntimeModel || (availableModels.length > 0 ? availableModels[0].name : '');
    if (!targetModel) {
      toast.warning('No model available to launch. Upload or download a model first in Model Hub.', 'No Model');
      return;
    }
    setIsStartingRuntime(true);
    try {
      const status = await runtimeApi.startModel({
        model: targetModel,
        port: Number(runtimePort) || 8080,
        ctx_size: Number(runtimeCtxSize) || 4096,
        n_gpu_layers: Number(runtimeGpuLayers) || 99,
        wait_ready: true,
      });
      setModelRuntime(status);
      toast.success(`llama-server online on port ${status.port} running "${status.model_name}"`, 'Server Ready');
      fetchLogs();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to start llama-server process.';
      toast.error(detail, 'Start Error');
    } finally {
      setIsStartingRuntime(false);
    }
  };

  const handleStopRuntime = async () => {
    const ok = await confirm({
      title: 'Stop llama-server Daemon',
      message: 'Are you sure you want to stop the model server? Any ongoing inferences will be terminated.',
      confirmText: 'Yes, Stop Server',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    setIsStoppingRuntime(true);
    try {
      const status = await runtimeApi.stopModel();
      setModelRuntime(status);
      toast.info('llama-server process stopped.', 'Server Stopped');
      fetchLogs();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to stop llama-server.';
      toast.error(detail, 'Stop Error');
    } finally {
      setIsStoppingRuntime(false);
    }
  };

  const handleStopAgentWorker = async (agentId: string, agentName: string) => {
    const ok = await confirm({
      title: 'Stop Agent Worker',
      message: `Terminate execution thread for agent "${agentName}"?`,
      confirmText: 'Stop Worker',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    setIsStoppingAgentId(agentId);
    try {
      await runtimeApi.stopAgent(agentId);
      setActiveAgents((prev) => prev.filter((a) => a.agent_id !== agentId));
      toast.success(`Agent worker "${agentName}" stopped.`, 'Worker Stopped');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to stop agent worker.';
      toast.error(detail, 'Stop Error');
    } finally {
      setIsStoppingAgentId(null);
    }
  };

  const handleTestPrompt = async () => {
    if (!testPrompt.trim()) return;
    setIsTestingModel(true);
    setTestResponse(null);
    setTestLatency(null);
    try {
      const res = await runtimeApi.testModel({
        prompt: testPrompt,
        max_tokens: 150,
      });
      setTestResponse(res.response);
      setTestLatency(res.latency_ms);
      toast.success(`Inference finished in ${res.latency_ms}ms`, 'Inference Completed');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Inference test failed.';
      toast.error(detail, 'Inference Error');
    } finally {
      setIsTestingModel(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span>Operations &amp; Engine Runtime</span>
            <Badge variant={modelRuntime?.ready ? 'active' : 'cyan'} size="sm" className="font-mono">
              {modelRuntime?.ready ? 'Engine Ready' : modelRuntime?.running ? 'Loading' : 'Offline'}
            </Badge>
            {activeAgents.length > 0 && (
              <Badge variant="active" pulse size="sm" className="font-mono">
                {activeAgents.length} Active {activeAgents.length === 1 ? 'Worker' : 'Workers'}
              </Badge>
            )}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Supervise on-premise execution loops, llama-server daemon, and deterministic agent threads
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={refreshOverview}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Refresh Status
          </Button>
        </div>
      </div>

      {/* Top Status Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Agent Runtime Card */}
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Agent Runtime</div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>{activeAgents.length} Active {activeAgents.length === 1 ? 'Worker' : 'Workers'}</span>
              {activeAgents.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">Scheduler Loop: 60s</div>
          </div>
        </div>

        {/* Model Server Card */}
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm flex items-center gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              modelRuntime?.ready
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : modelRuntime?.running
                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400'
            }`}
          >
            <Cpu className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Model Runtime</div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>{modelRuntime?.ready ? 'Ready' : modelRuntime?.running ? 'Loading' : 'Offline'}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  modelRuntime?.ready
                    ? 'bg-emerald-500'
                    : modelRuntime?.running
                    ? 'bg-amber-500 animate-spin'
                    : 'bg-zinc-400 dark:bg-zinc-500'
                }`}
              />
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
              {modelRuntime?.model_name || 'No model loaded'}
            </div>
          </div>
        </div>

        {/* llama.cpp Engine Card */}
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">llama.cpp Engine</div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {overview?.llama_installed ? 'llama.cpp Ready' : 'llama.cpp Standby'}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
              Binary: /usr/local/bin
            </div>
          </div>
        </div>

        {/* Security & Concurrency Card */}
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Security Boundary</div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Air-Gapped Node</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Egress: 0.0 KB (Local)</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Operational Controls Bar (Agent Page Style) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('agent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'agent'
                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Agent Runtime</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
              {activeAgents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('model');
              fetchLogs();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'model'
                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Model Runtime</span>
            {modelRuntime?.ready && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
            )}
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                modelRuntime?.ready
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {modelRuntime?.ready ? 'Ready' : modelRuntime?.running ? 'Loading' : 'Offline'}
            </span>
          </button>
        </div>

        {/* Right side live status indicator */}
        <div className="flex items-center gap-3 px-3 py-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          <span>Engine: <strong className="text-zinc-800 dark:text-zinc-200">{modelRuntime?.running ? `PID ${modelRuntime.pid}` : 'Offline'}</strong></span>
          <span>·</span>
          <span>Port: <strong className="text-cyan-600 dark:text-cyan-400">{runtimePort}</strong></span>
        </div>
      </div>

      {/* TAB 1: AGENT RUNTIME STATUS */}
      {activeTab === 'agent' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-zinc-900/70 border border-zinc-200/90 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Active Agent Worker Threads
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Real-time status of agent threads registered in the runtime execution table.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-500">
                  {activeAgents.length} active running {activeAgents.length === 1 ? 'instance' : 'instances'}
                </span>
              </div>
            </div>

            {isLoadingAgents ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs font-mono">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span>Checking runtime registry...</span>
              </div>
            ) : activeAgents.length === 0 ? (
              <div className="py-12 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-dashed border-zinc-200 dark:border-zinc-800/80 text-center space-y-2">
                <Bot className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto" />
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No Active Agent Threads</div>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  Agents will appear here automatically when triggered by the periodic scheduler or executed on-demand through chat.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 uppercase">
                      <th className="py-3 px-4">Agent Name</th>
                      <th className="py-3 px-4">Assigned Model</th>
                      <th className="py-3 px-4">Thread ID</th>
                      <th className="py-3 px-4">Started At</th>
                      <th className="py-3 px-4">Last Heartbeat</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                    {activeAgents.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                          <span>{item.agent_name}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 font-mono">
                          {item.agent_model || 'Local Model'}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                          {item.thread_name || item.id.slice(0, 12)}
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                          {new Date(item.started_at).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400/90 font-mono text-[11px]">
                          {new Date(item.last_heartbeat).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            disabled={isStoppingAgentId === item.agent_id}
                            onClick={() => handleStopAgentWorker(item.agent_id, item.agent_name)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/20 border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>{isStoppingAgentId === item.agent_id ? 'Stopping...' : 'Terminate'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MODEL RUNTIME STATUS (MOVED FROM MODEL HUB) */}
      {activeTab === 'model' && (
        <div className="space-y-6">
          {/* Hero Daemon Status Card */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-white ${
                    modelRuntime?.ready
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/20'
                      : modelRuntime?.running
                      ? 'bg-gradient-to-tr from-amber-600 to-orange-600 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-100">
                      llama-server Daemon Process
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
                        : 'OFFLINE / STOPPED'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    {modelRuntime?.running
                      ? `Active PID: ${modelRuntime.pid} • Model: ${modelRuntime.model_name || 'GGUF'} • Uptime: ${modelRuntime.uptime_seconds || 0}s`
                      : 'Server is stopped. Select a model below to launch local inference.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const st = await runtimeApi.getModelStatus();
                    setModelRuntime(st);
                    fetchLogs();
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer shadow-xs"
                  title="Refresh status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                {modelRuntime?.running ? (
                  <button
                    type="button"
                    onClick={handleStopRuntime}
                    disabled={isStoppingRuntime}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30 border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>{isStoppingRuntime ? 'Stopping...' : 'Stop Server'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRuntime}
                    disabled={isStartingRuntime}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isStartingRuntime ? 'Starting...' : 'Start Server'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Base URL Bar */}
            {modelRuntime?.running && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">OpenAI Base URL:</span>
                  <code className="text-cyan-700 dark:text-cyan-300 bg-zinc-100 dark:bg-zinc-950 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 font-semibold">
                    {modelRuntime.base_url}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(modelRuntime.base_url);
                      setCopiedEndpoint(true);
                      setTimeout(() => setCopiedEndpoint(false), 2000);
                    }}
                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Copy API Base URL"
                  >
                    {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400 text-[11px]">
                  <span>Ctx: <b className="text-zinc-800 dark:text-zinc-200">{modelRuntime.ctx_size}</b></span>
                  <span>GPU Offload: <b className="text-zinc-800 dark:text-zinc-200">{modelRuntime.n_gpu_layers} layers</b></span>
                  <span>Threads: <b className="text-zinc-800 dark:text-zinc-200">{modelRuntime.threads || 'Auto'}</b></span>
                </div>
              </div>
            )}
          </div>

          {/* Config Card and Test Card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Model Launcher Configuration */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Power className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Model Runner & Daemon Settings
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-mono mb-1 font-semibold">
                    SELECT GGUF MODEL
                  </label>
                  {availableModels.length === 0 ? (
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-500 text-xs">
                      No models found in backend. Upload or download a GGUF model in Model Hub first.
                    </div>
                  ) : (
                    <select
                      value={selectedRuntimeModel}
                      onChange={(e) => setSelectedRuntimeModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="">-- Choose a local model --</option>
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({m.quantization || 'GGUF'} • {formatFileSize(m.size_bytes)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 font-mono mb-1 font-semibold">
                      PORT
                    </label>
                    <input
                      type="number"
                      value={runtimePort}
                      onChange={(e) => setRuntimePort(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 font-mono mb-1 font-semibold">
                      CONTEXT
                    </label>
                    <select
                      value={runtimeCtxSize}
                      onChange={(e) => setRuntimeCtxSize(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value={2048}>2048</option>
                      <option value={4096}>4096</option>
                      <option value={8192}>8192</option>
                      <option value={16384}>16384</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 font-mono mb-1 font-semibold">
                      GPU LAYERS
                    </label>
                    <input
                      type="number"
                      value={runtimeGpuLayers}
                      onChange={(e) => setRuntimeGpuLayers(Number(e.target.value))}
                      placeholder="99 = Max"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartRuntime}
                  disabled={isStartingRuntime || availableModels.length === 0}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {isStartingRuntime ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Booting llama-server...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>{modelRuntime?.running ? 'Switch & Reload Model' : 'Launch llama-server'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inference Diagnostic Test Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-4 flex flex-col justify-between shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-3">
                  <Send className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Live Inference Diagnostic Test
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-mono text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                      TEST PROMPT
                    </label>
                    <textarea
                      rows={2}
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      placeholder="Prompt the active model directly..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 resize-none font-sans"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTestPrompt}
                    disabled={isTestingModel || !modelRuntime?.ready}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/30 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isTestingModel ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-cyan-600 dark:border-cyan-300 border-t-transparent rounded-full animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Execute Prompt</span>
                      </>
                    )}
                  </button>

                  {testResponse && (
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1 animate-in fade-in">
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>MODEL OUTPUT</span>
                        {testLatency && <span className="text-cyan-600 dark:text-cyan-400 font-bold">{testLatency} ms</span>}
                      </div>
                      <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">{testResponse}</p>
                    </div>
                  )}
                </div>
              </div>

              {!modelRuntime?.ready && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500">
                  Model daemon must be started and reported <b className="text-emerald-600 dark:text-emerald-400">READY</b> to run live diagnostic inference.
                </div>
              )}
            </div>
          </div>

          {/* Real-Time Terminal Logs Stream Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                llama-server Console Stdout / Stderr Stream
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-zinc-500">
                  {runtimeLogs.length} lines captured
                </span>
                <button
                  type="button"
                  onClick={() => { void fetchLogs(); }}
                  disabled={isFetchingLogs}
                  className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  title="Refresh console logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingLogs ? 'animate-spin' : ''}`} />
                  <span>Fetch Logs</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 dark:bg-black border border-zinc-300 dark:border-zinc-800/80 font-mono text-[11px] text-zinc-100 dark:text-zinc-300 h-64 overflow-y-auto space-y-1 select-text">
              {runtimeLogs.length === 0 ? (
                <div className="text-zinc-500 italic">No output logged yet. Start the model server to stream console stdout/stderr.</div>
              ) : (
                runtimeLogs.map((line, idx) => (
                  <div key={idx} className="leading-tight hover:bg-zinc-900/80">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
