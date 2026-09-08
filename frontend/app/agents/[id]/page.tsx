"use client";

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Bot,
  ArrowLeft,
  Send,
  Square,
  Wrench,
  FileText,
  Clock,
  Settings,
  AlertCircle,
  Play,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Terminal,
  ExternalLink,
  Activity,
  CheckCircle2,
  RotateCw,
} from 'lucide-react';
import { Agent, AgentRunResponse, AIModelResponse, DocumentResponse, AgentTrigger, AgentActionRecord } from '@/lib/api/types';
import { agentsApi } from '@/lib/api/agents';
import { modelsApi } from '@/lib/api/models';
import { documentsApi } from '@/lib/api/documents';
import { useToast } from '@/context/toast-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  WORKBENCH_TOOLS,
  TOOL_CATEGORIES,
} from '@/lib/constants/tools';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: Array<{ name?: string; arguments?: Record<string, unknown>; result?: unknown }>;
  status?: string;
  latencyMs?: number;
}

const STEP_STAGES = [
  { key: 'started', label: 'Agent Started' },
  { key: 'reasoning', label: 'Model Reasoning' },
  { key: 'tool', label: 'Executing Tool' },
  { key: 'done', label: 'Execution Finished' },
];

export default function AgentWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { toast, confirm } = useToast();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<'chat' | 'config' | 'tools' | 'knowledge' | 'actions'>(
    initialTab === 'config' || initialTab === 'tools' || initialTab === 'knowledge' || initialTab === 'actions'
      ? initialTab
      : 'chat'
  );

  const [actions, setActions] = useState<AgentActionRecord[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);

  const fetchActions = React.useCallback(async () => {
    setIsLoadingActions(true);
    try {
      const data = await agentsApi.getAgentActions(id);
      setActions(data || []);
    } catch {
      // ignore
    } finally {
      setIsLoadingActions(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'actions') {
      fetchActions();
    }
  }, [activeTab, fetchActions]);


  const [agent, setAgent] = useState<Agent | null>(null);
  const [models, setModels] = useState<AIModelResponse[]>([]);
  const [allDocs, setAllDocs] = useState<DocumentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Chat & Execution States
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-welcome',
      role: 'agent',
      content: 'Autonomous Mission Console initialized. Ready to execute instructions against local GGUF weights and authorized system tools.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('idle');
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [liveStatusDetail, setLiveStatusDetail] = useState<string>('');
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [executionLogs, setExecutionLogs] = useState<AgentRunResponse[]>([]);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inline Configuration Form State
  const [configName, setConfigName] = useState('');
  const [configDesc, setConfigDesc] = useState('');
  const [configInstructions, setConfigInstructions] = useState('');
  const [configModelId, setConfigModelId] = useState('');
  const [configTools, setConfigTools] = useState<string[]>([]);
  const [configTrigger, setConfigTrigger] = useState<AgentTrigger>('manual');
  const [configSchedule, setConfigSchedule] = useState('');
  const [configMaxExecutionTime, setConfigMaxExecutionTime] = useState(15);
  const [configMaxToolCalls, setConfigMaxToolCalls] = useState(40);
  const [configConcurrency, setConfigConcurrency] = useState(1);
  const [configRetries, setConfigRetries] = useState(3);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Active Tool Category Filter for Tools Tab
  const [activeToolCategory, setActiveToolCategory] = useState<string>('all');

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      agentsApi.getAgent(id),
      modelsApi.getModels(),
      documentsApi.getDocuments(),
    ]).then(([agentRes, modelsRes, docsRes]) => {
      if (!active) return;

      let loadedAgent: Agent | null = null;
      if (agentRes.status === 'fulfilled' && agentRes.value) {
        loadedAgent = agentRes.value;
        setAgent(loadedAgent);
        setConfigName(loadedAgent.name);
        setConfigDesc(loadedAgent.description || '');
        setConfigInstructions(loadedAgent.instructions);
        setConfigModelId(loadedAgent.model_id || '');
        setConfigTools(loadedAgent.tools?.map((t) => t.name) || []);
        setConfigTrigger(loadedAgent.trigger || 'manual');
        setConfigSchedule(loadedAgent.schedule || '');
        setConfigMaxExecutionTime(loadedAgent.max_execution_time ?? 15);
        setConfigMaxToolCalls(loadedAgent.max_tool_calls ?? 40);
        setConfigConcurrency(loadedAgent.concurrency ?? 1);
        setConfigRetries(loadedAgent.retries ?? 3);
      } else {
        setNotFound(true);
      }

      if (modelsRes.status === 'fulfilled') {
        const availableModels = modelsRes.value || [];
        setModels(availableModels);
        if (availableModels.length > 0) {
          if (!loadedAgent || !availableModels.some((m) => m.id === loadedAgent?.model_id)) {
            setConfigModelId(availableModels[0].id);
          }
        }
      }
      if (docsRes.status === 'fulfilled') {
        setAllDocs(docsRes.value || []);
      }


      // Check live thread status for this agent
      agentsApi.getAgentThreadStatus(id).then((tStatus) => {
        if (!active) return;
        if (tStatus?.is_alive) {
          setIsExecuting(true);
          setCurrentStep('reasoning');
          setLiveStatusDetail(`Thread '${tStatus.thread_name || 'AgentStream'}' actively running`);
        }
      }).catch(() => {});

      setIsLoading(false);
    });

    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [id]);


  const toggleToolCallAccordion = (key: string) => {
    setExpandedToolCalls((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    toast.info('Message content copied to clipboard.', 'Copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Execute Agent Prompt via Real-time Server-Sent Events (SSE) stream with Keep-Alive
  const handleSendPrompt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isExecuting) return;

    const userText = prompt.trim();
    setPrompt('');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const agentMsgId = `ag-${Date.now()}`;
    const initialAgentMsg: ChatMessage = {
      id: agentMsgId,
      role: 'agent',
      content: 'Connecting to agent runtime event stream...',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      toolCalls: [],
      status: 'running',
    };

    setMessages((prev) => [...prev, userMsg, initialAgentMsg]);
    setIsExecuting(true);
    setCurrentStep('started');
    setLiveStatusDetail('Connecting to runtime...');

    const startTime = performance.now();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const liveToolCalls: Array<{ name?: string; arguments?: Record<string, unknown>; result?: unknown; status?: string }> = [];

    try {
      await agentsApi.runAgentStream({
        id,
        prompt: userText,
        signal: abortController.signal,
        onEvent: (event) => {
          if (event.type === 'ping') {
            setLastHeartbeat(new Date().toLocaleTimeString());
            return;
          }

          if (event.type === 'agent_started') {
            setCurrentStep('started');
            setLiveStatusDetail(`Agent started on ${event.provider || 'local model'}`);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMsgId
                  ? { ...m, content: `Agent '${event.agent_name || 'Agent'}' initialized. Executing instructions...` }
                  : m
              )
            );
          } else if (event.type === 'reasoning_step') {
            setCurrentStep('reasoning');
            setLiveStatusDetail(`Turn #${event.step || 1}: Querying model turn...`);
          } else if (event.type === 'model_output') {
            if (event.content && !event.content.includes('"action": "call_tool"')) {
              setMessages((prev) =>
                prev.map((m) => (m.id === agentMsgId ? { ...m, content: event.content || '' } : m))
              );
            }
          } else if (event.type === 'tool_call') {
            setCurrentStep('tool');
            setLiveStatusDetail(`Invoking tool: ${event.tool}`);
            liveToolCalls.push({
              name: event.tool,
              arguments: event.arguments,
              status: 'invoking',
            });
            setMessages((prev) =>
              prev.map((m) => (m.id === agentMsgId ? { ...m, toolCalls: [...liveToolCalls] } : m))
            );
          } else if (event.type === 'tool_result') {
            setCurrentStep('tool');
            setLiveStatusDetail(`Tool finished: ${event.tool} (${event.status || 'success'})`);
            const idx = liveToolCalls.findIndex(
              (tc) => tc.name === event.tool && tc.status === 'invoking'
            );
            if (idx !== -1) {
              liveToolCalls[idx] = {
                ...liveToolCalls[idx],
                result: event.result,
                status: event.status || 'success',
              };
            } else {
              liveToolCalls.push({
                name: event.tool,
                result: event.result,
                status: event.status || 'success',
              });
            }
            setMessages((prev) =>
              prev.map((m) => (m.id === agentMsgId ? { ...m, toolCalls: [...liveToolCalls] } : m))
            );
          } else if (event.type === 'completed') {
            const elapsed = Math.round(performance.now() - startTime);
            setCurrentStep('done');
            setLiveStatusDetail(`Completed in ${event.elapsed_seconds || (elapsed / 1000).toFixed(1)}s`);

            const finalMsg: ChatMessage = {
              id: agentMsgId,
              role: 'agent',
              content: event.response || 'Mission execution concluded.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              toolCalls: event.tool_calls || [...liveToolCalls],
              status: 'completed',
              latencyMs: elapsed,
            };

            setMessages((prev) => prev.map((m) => (m.id === agentMsgId ? finalMsg : m)));

            const runLog: AgentRunResponse = {
              execution_id: agentMsgId,
              agent_id: id,
              status: 'completed',
              response: event.response || '',
              tool_calls: event.tool_calls || [...liveToolCalls],
              completed_at: new Date().toISOString(),
            };
            setExecutionLogs((prev) => [runLog, ...prev]);
            toast.success(`Mission executed successfully in ${elapsed}ms.`, 'Task Completed');
          }
        },
        onError: (err) => {
          toast.error(err.message || 'Error in agent streaming', 'Stream Error');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentMsgId
                ? { ...m, content: `[Execution Error] ${err.message}`, status: 'failed' }
                : m
            )
          );
        },
      });
    } catch (err: unknown) {
      if (!abortController.signal.aborted) {
        const detail = err instanceof Error ? err.message : String(err);
        toast.error(detail, 'Execution Error');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? { ...m, content: `[Execution Error] ${detail}`, status: 'failed' }
              : m
          )
        );
      }
    } finally {
      setIsExecuting(false);
      abortControllerRef.current = null;
      setTimeout(() => setCurrentStep('idle'), 3000);
    }
  };

  // Keyboard shortcut Ctrl + Enter to dispatch
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  // Stop / Abort Worker
  const handleStopExecution = async () => {
    if (!isExecuting) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    try {
      await agentsApi.stopAgent(id, activeExecutionId || undefined);
      setAgent((prev) => (prev ? { ...prev, is_running: false } : null));
      toast.info('Agent execution terminated by operator signal.', 'Run Stopped');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to stop execution on backend.';
      toast.error(detail, 'Stop Error');
    } finally {
      setIsExecuting(false);
      setCurrentStep('idle');
      setMessages((prev) => [
        ...prev,
        {
          id: `stop-${Date.now()}`,
          role: 'system',
          content: 'Execution aborted by operator signal.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Save Inline Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const updated = await agentsApi.updateAgent(id, {
        name: configName.trim(),
        description: configDesc.trim() || undefined,
        instructions: configInstructions.trim(),
        model_id: configModelId,
        tools: configTools,
        trigger: configTrigger,
        schedule: (configTrigger === 'schedule' || configTrigger === 'onetime') ? configSchedule : undefined,
        max_execution_time: configMaxExecutionTime,
        max_tool_calls: configMaxToolCalls,
        concurrency: configConcurrency,
        retries: configRetries,
      });
      setAgent(updated);
      setConfigSaveSuccess(true);
      toast.success('Agent parameters updated in database.', 'Configuration Saved');
      setTimeout(() => setConfigSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update configuration.';
      toast.error(detail, 'Update Failed');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Toggle Tool in Tools Tab
  const handleToggleTool = async (toolName: string) => {
    const nextTools = configTools.includes(toolName)
      ? configTools.filter((t) => t !== toolName)
      : [...configTools, toolName];

    setConfigTools(nextTools);
    try {
      const updated = await agentsApi.updateAgent(id, { tools: nextTools });
      setAgent(updated);
      toast.info(`Tool "${toolName}" ${nextTools.includes(toolName) ? 'granted' : 'revoked'}.`, 'Permissions Updated');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update tool permissions';
      toast.error(detail, 'Update Failed');
    }
  };

  // Unlink Document
  const handleUnlinkDoc = async (docId: string, docName?: string) => {
    if (!agent) return;
    const ok = await confirm({
      title: 'Unlink Document',
      message: `Unlink "${docName || 'document'}" from this agent? The document remains safely stored in the Knowledge Vault.`,
      confirmText: 'Yes, Unlink',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    const nextDocIds = (agent.documents || [])
      .filter((d) => d.id !== docId)
      .map((d) => d.id);
    try {
      const updated = await agentsApi.updateAgent(id, { document_ids: nextDocIds });
      setAgent(updated);
      toast.success('Document unlinked from agent context.', 'Unlinked');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to unlink document.';
      toast.error(detail, 'Error');
    }
  };

  // Link Document
  const handleLinkDoc = async (doc: DocumentResponse) => {
    if (!agent) return;
    const nextDocIds = [...(agent.documents || []).map((d) => d.id), doc.id];
    try {
      const updated = await agentsApi.updateAgent(id, { document_ids: nextDocIds });
      setAgent(updated);
      toast.success(`Attached "${doc.name}" to agent context.`, 'Knowledge Attached');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to attach document.';
      toast.error(detail, 'Error');
    }
  };

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-zinc-500">Connecting to Mission Console...</span>
      </div>
    );
  }

  if (notFound || !agent) {
    return (
      <div className="p-12 text-center rounded-2xl glass-card space-y-4 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-zinc-100">Agent Not Found in Database</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The requested agent UUID does not exist or has been decommissioned from the fleet.
        </p>
        <Link href="/agents">
          <Button variant="secondary" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Fleet Catalog</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Top Breadcrumb & Mission Header Card */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <Link
              href="/agents"
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-zinc-100">{agent.name}</h1>
                <Badge variant={agent.is_running || isExecuting ? 'active' : 'offline'}>
                  {agent.is_running || isExecuting ? 'Worker Active' : 'Standby'}
                </Badge>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                  {agent.model || agent.ai_model?.name || 'Local GGUF'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/80 capitalize">
                  {agent.trigger === 'onetime' ? 'one-time' : (agent.trigger || 'manual')}
                </span>
                {agent.schedule && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 hidden sm:inline">
                    {agent.schedule}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-1 max-w-2xl">
                {agent.description || 'Autonomous agent connected to local runtime.'}
              </p>
            </div>
          </div>

          {/* Header Quick Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {isExecuting ? (
              <Button
                variant="danger"
                size="sm"
                onClick={handleStopExecution}
                className="gap-2 shadow-lg shadow-rose-500/10"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Abort Worker</span>
              </Button>
            ) : (
              <Button
                variant="emerald"
                size="sm"
                onClick={() => {
                  setActiveTab('chat');
                  if (!prompt.trim()) {
                    setPrompt('Execute immediate system diagnostic check.');
                  }
                }}
                className="gap-2 shadow-lg shadow-emerald-500/10"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Agent Now</span>
              </Button>
            )}
          </div>
        </div>

        {/* Tab Switcher Bar */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Agent</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'config'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Agent Details</span>
            </button>


            <button
              type="button"
              onClick={() => setActiveTab('tools')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'tools'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Tools ({configTools.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('knowledge')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'knowledge'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Knowledge ({agent.documents?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('actions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'actions'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Actions & Outputs</span>
            </button>
          </div>


          <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-zinc-500">
            <span>Air-Gapped: <strong className="text-emerald-400">0.0 KB Egress</strong></span>
            <span>·</span>
            <span>Host: <strong className="text-zinc-300">127.0.0.1:8000</strong></span>
          </div>
        </div>
      </div>

      {/* TAB 1: RUN AGENT & LIVE EXECUTION MONITOR */}
      {activeTab === 'chat' && (
        <div className="space-y-6">
          {/* TOP SECTION: RUN AGENT ACTION CARD */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
                  <Play className="w-5 h-5 fill-cyan-400/30" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    Run Agent: {agent.name}
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isExecuting
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      {isExecuting ? 'Worker Running' : 'Standby'}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Dispatch instructions to the agent runtime. Real-time events and keep-alive heartbeats stream directly below.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isExecuting ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleStopExecution}
                    className="gap-2 px-4 shadow-lg shadow-rose-950/30"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Execution</span>
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSendPrompt()}
                    disabled={!prompt.trim() || isExecuting}
                    className="gap-2 px-5 shadow-lg shadow-cyan-950/30"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Agent</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Prompt input textarea */}
            <form onSubmit={handleSendPrompt} className="space-y-3">
              <div className="relative">
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isExecuting}
                  placeholder="Enter task prompt or instructions for this agent (e.g. 'Check system time and summarize files', or press Ctrl+Enter to run)..."
                  className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-sans transition-colors resize-none disabled:opacity-50"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
                <div className="flex items-center gap-3">
                  <span>Press <strong className="text-zinc-300">Ctrl + Enter</strong> to execute</span>
                  <span>·</span>
                  <span>Model: <strong className="text-cyan-400">{agent.ai_model?.name || agent.model || 'Local Model'}</strong></span>
                  <span>·</span>
                  <span>Max Tools: <strong className="text-zinc-300">{agent.max_tool_calls || 40}</strong></span>
                </div>

                {prompt.trim() && !isExecuting && (
                  <button
                    type="button"
                    onClick={() => setPrompt('')}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    Clear Input
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Quick Agent Details Summary Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-200">Instructions:</span>
                <span className="text-zinc-400 font-sans line-clamp-1 max-w-xl">
                  {agent.instructions || 'No custom instructions set.'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-500">
                <span>Trigger: <strong className="text-zinc-300 capitalize">{agent.trigger || 'manual'}</strong></span>
                <span>·</span>
                <span>Active Model: <strong className="text-cyan-400">{agent.ai_model?.name || agent.model || 'Local Model'}</strong></span>
                <span>·</span>
                <span>Tools Enabled: <strong className="text-zinc-300">{configTools.length}</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
            >
              Edit Agent Details →
            </button>
          </div>

          {/* BELOW SECTION: WHAT THE AGENT IS DOING */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide font-mono flex items-center gap-2">
                  What the Agent is Doing
                  {liveStatusDetail && (

                    <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 normal-case font-sans">
                      {liveStatusDetail}
                    </span>
                  )}
                </h3>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono">
                {lastHeartbeat && (
                  <span className="text-zinc-400 flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    keep-alive
                  </span>
                )}
                <span className="text-zinc-500">Real-Time Event Stream</span>
              </div>
            </div>

            {/* Pipeline Stage Tracker */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
                {STEP_STAGES.map((st, i) => {
                  const stepOrder: Record<string, number> = {
                    started: 0,
                    reasoning: 1,
                    tool: 2,
                    done: 3,
                  };
                  const currIdx = stepOrder[currentStep] ?? -1;
                  const isPassed = currentStep === 'done' || currIdx > i;
                  const isCurrent = currentStep === st.key;

                  return (
                    <div key={st.key} className="flex items-center gap-2">
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                          isCurrent
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-bold shadow-sm shadow-cyan-500/20'
                            : isPassed
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-zinc-900/50 border-zinc-800/60 text-zinc-600'
                        }`}
                      >
                        {isPassed ? '✓' : isCurrent ? '●' : '○'} {st.label}
                      </span>
                      {i < STEP_STAGES.length - 1 && <span className="text-zinc-700">→</span>}
                    </div>
                  );
                })}
              </div>

              {isExecuting && (
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                  <span>Agent Working...</span>
                </div>
              )}
            </div>

            {/* Chronological Activity Feed */}
            <div className="min-h-[280px] max-h-[640px] overflow-y-auto space-y-4 pr-1">
              {messages.length <= 1 && currentStep === 'idle' ? (
                <div className="p-12 text-center rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800 space-y-2">
                  <Bot className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-medium text-zinc-300">Agent is currently on standby</p>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Enter instructions in the panel above and click &apos;Run Agent&apos; to watch live actions, tool invocations, and reasoning.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isSystem = msg.role === 'system';

                  if (isSystem) {
                    return (
                      <div
                        key={msg.id}
                        className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center text-xs text-zinc-400 font-mono"
                      >
                        {msg.content}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1 text-[11px] font-mono text-zinc-500">
                        <span>{isUser ? 'Operator Task' : agent.name}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                        {msg.latencyMs !== undefined && (
                          <span className="text-cyan-400/80">({msg.latencyMs}ms)</span>
                        )}
                      </div>

                      <div
                        className={`max-w-3xl w-full p-4 rounded-2xl text-xs sm:text-sm leading-relaxed relative group ${
                          isUser
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-xs shadow-md shadow-cyan-950/30'
                            : 'bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap font-sans">{msg.content}</p>

                        {/* Copy Action Overlay */}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>

                        {/* Step-by-Step Tool Call Inspector Accordion */}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2">
                            <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5" />
                                Tool Execution Traces ({msg.toolCalls.length} Invocations)
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {msg.toolCalls.map((tc, idx) => {
                                const accordionKey = `${msg.id}-tc-${idx}`;
                                const isExpanded = Boolean(expandedToolCalls[accordionKey]);

                                return (
                                  <div
                                    key={idx}
                                    className="rounded-xl bg-zinc-900/90 border border-zinc-800/90 overflow-hidden text-xs font-mono"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleToolCallAccordion(accordionKey)}
                                      className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                                        <span className="text-zinc-200 font-semibold">
                                          {tc.name || 'tool_invocation'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                          Status: OK
                                        </span>
                                        {isExpanded ? (
                                          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                                        )}
                                      </div>
                                    </button>

                                    {isExpanded && (
                                      <div className="p-3 border-t border-zinc-800/80 space-y-2 bg-zinc-950">
                                        {tc.arguments && (
                                          <div>
                                            <span className="text-[10px] uppercase text-zinc-500 block mb-0.5">
                                              Parameters Schema:
                                            </span>
                                            <pre className="p-2 rounded-lg bg-zinc-900 text-zinc-300 text-[11px] overflow-x-auto">
                                              {JSON.stringify(tc.arguments, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                        {Boolean(tc.result) && (
                                          <div>
                                            <span className="text-[10px] uppercase text-zinc-500 block mb-0.5">
                                              Execution Output:
                                            </span>
                                            <pre className="p-2 rounded-lg bg-zinc-900 text-emerald-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
                                              {typeof tc.result === 'object'
                                                ? JSON.stringify(tc.result, null, 2)
                                                : String(tc.result)}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}


      {/* TAB 2: AGENT DETAILS & CONFIGURATION */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Agent Details & Configuration</h2>
              <p className="text-xs text-zinc-400">
                View and edit agent name, description, system instructions, active model, and runtime constraints.
              </p>
            </div>
            {configSaveSuccess && (
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Agent Details Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase">
                Agent Designation
              </label>
              <input
                type="text"
                required
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-mono font-semibold text-zinc-400 uppercase">
                Mission Description
              </label>
              <input
                type="text"
                value={configDesc}
                onChange={(e) => setConfigDesc(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase">
                  System Instructions & Reasoning Directives
                </label>
                <span className="text-[10px] font-mono text-zinc-500">{configInstructions.length} chars</span>
              </div>
              <textarea
                rows={5}
                required
                value={configInstructions}
                onChange={(e) => setConfigInstructions(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono leading-relaxed focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase">
                Target GGUF Model Runtime
              </label>
              <select
                value={configModelId}
                onChange={(e) => setConfigModelId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono cursor-pointer"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.quantization || 'GGUF'}) — {m.filename}
                  </option>
                ))}
              </select>
            </div>

            {/* Trigger Mode */}
            <div className="space-y-1.5 sm:col-span-2 pt-2">
              <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase">
                Execution Trigger Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(['manual', 'schedule', 'onetime'] as AgentTrigger[]).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setConfigTrigger(t)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-mono capitalize border transition-all cursor-pointer text-left ${
                      configTrigger === t
                        ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/50 font-bold'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold">{t === 'onetime' ? 'one-time' : t}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {t === 'manual' ? 'Operator dispatch' : t === 'schedule' ? 'Periodic interval' : 'Single calendar run'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {(configTrigger === 'schedule' || configTrigger === 'onetime') && (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase">
                  Schedule Expression
                </label>
                <input
                  type="text"
                  value={configSchedule}
                  onChange={(e) => setConfigSchedule(e.target.value)}
                  placeholder={configTrigger === 'schedule' ? 'e.g. Every 1 day at 09:00' : 'e.g. Once on 2026-09-10 at 09:00'}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>

          {/* Safety Constraints & Execution Limits */}
          <div className="pt-4 border-t border-zinc-800 space-y-4">
            <h3 className="text-xs font-bold text-zinc-200 font-mono uppercase">
              Safety Constraints & Resource Limits
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  MAXIMUM EXECUTION TIMEOUT (MIN)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={configMaxExecutionTime}
                  onChange={(e) => setConfigMaxExecutionTime(parseInt(e.target.value) || 15)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  MAXIMUM TOOL CALL BUDGET
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={configMaxToolCalls}
                  onChange={(e) => setConfigMaxToolCalls(parseInt(e.target.value) || 40)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  CONCURRENCY THREADS
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={configConcurrency}
                  onChange={(e) => setConfigConcurrency(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  AUTOMATIC RETRIES
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={configRetries}
                  onChange={(e) => setConfigRetries(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-end">
            <Button
              variant="primary"
              size="md"
              disabled={isSavingConfig}
              className="gap-2 shadow-lg shadow-cyan-500/20"
            >
              {isSavingConfig ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Agent Details</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* TAB 3: 19-TOOL PERMISSION MATRIX */}
      {activeTab === 'tools' && (
        <div className="glass-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Tool Permissions Matrix</h2>
              <p className="text-xs text-zinc-400">
                Grant or revoke deterministic execution capabilities for this agent.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="cyan">
                {configTools.length} of {WORKBENCH_TOOLS.length} Granted
              </Badge>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveToolCategory('all')}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                activeToolCategory === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              All Categories
            </button>
            {TOOL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveToolCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                  activeToolCategory === cat.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {/* Tool Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {WORKBENCH_TOOLS.filter(
              (t) => activeToolCategory === 'all' || t.category === activeToolCategory
            ).map((tool) => {
              const hasTool = configTools.includes(tool.name);
              const Icon = tool.icon;

              return (
                <div
                  key={tool.id}
                  onClick={() => handleToggleTool(tool.name)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                    hasTool
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200 shadow-sm shadow-cyan-500/5'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      hasTool
                        ? 'bg-cyan-500 border-cyan-500 text-zinc-950'
                        : 'border-zinc-700 bg-zinc-950 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${hasTool ? 'text-cyan-400' : 'text-zinc-500'}`} />
                        <span className="font-mono font-bold text-xs text-zinc-200 truncate">
                          {tool.displayName}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase shrink-0 ${
                          hasTool
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {hasTool ? 'Granted' : 'Revoked'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {tool.description}
                    </p>
                    <div className="text-[10px] font-mono text-zinc-500 truncate mt-1">
                      args: {tool.parametersHint}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: KNOWLEDGE ATTACHMENTS */}
      {activeTab === 'knowledge' && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Attached Knowledge Documents</h2>
              <p className="text-xs text-zinc-400">
                Indexed technical manuals and files accessible for semantic RAG vector retrieval.
              </p>
            </div>
            <Link href="/documents">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-cyan-400">
                <span>Knowledge Vault</span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {agent.documents && agent.documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {agent.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-200 truncate">{doc.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {doc.mime_type || 'PDF Document'} · {doc.chunk_count || 12} vectors
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnlinkDoc(doc.id, doc.name)}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                    >
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs text-zinc-500 font-mono">
                No documents currently attached to this agent. Attach an ingested file below.
              </div>
            )}
          </div>

          {/* Attach from Vault */}
          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <h3 className="text-xs font-bold font-mono text-zinc-400 uppercase">
              Available in Knowledge Vault
            </h3>
            {allDocs.filter((d) => !agent.documents?.some((ad) => ad.id === d.id)).length === 0 ? (
              <div className="text-xs text-zinc-500 font-mono">
                All indexed vault documents are currently attached, or no documents uploaded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {allDocs
                  .filter((d) => !agent.documents?.some((ad) => ad.id === d.id))
                  .map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="truncate text-zinc-300 block">{d.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{d.file_type || 'PDF'}</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleLinkDoc(d)}
                        className="text-[11px] h-7 px-2.5 shrink-0"
                      >
                        + Attach
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: ACTIONS & OUTPUTS --- */}
      {activeTab === 'actions' && (
        <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Agent Actions & Final Output Records</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Persistent execution records stored in the <code className="text-cyan-400 font-mono">agent_actions</code> database table.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchActions}
              disabled={isLoadingActions}
              leftIcon={<RotateCw className={`w-3.5 h-3.5 ${isLoadingActions ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>

          {isLoadingActions ? (
            <div className="space-y-4">
              {[1, 2].map((k) => (
                <div key={k} className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse space-y-3">
                  <div className="h-4 bg-zinc-800 rounded w-1/4" />
                  <div className="h-16 bg-zinc-800/60 rounded" />
                </div>
              ))}
            </div>
          ) : actions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800/80 space-y-3">
              <Activity className="w-8 h-8 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-300">No Execution Records Yet</p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Run this agent to generate execution actions and final output records in the database.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveTab('chat')}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                Run Agent Now
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {actions.map((act) => {
                const isCompleted = act.status === 'completed';
                return (
                  <div
                    key={act.id}
                    className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-lg space-y-4 transition-all hover:border-zinc-700/80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono ${
                            isCompleted
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          <span className="capitalize">{act.status}</span>
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          {act.tool_calls_count} {act.tool_calls_count === 1 ? 'Tool Call' : 'Tool Calls'}
                        </span>
                        {act.execution_time_seconds !== null && act.execution_time_seconds !== undefined && (
                          <span className="text-xs text-zinc-500 font-mono">
                            · {act.execution_time_seconds.toFixed(1)}s
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {new Date(act.created_at).toLocaleString()}
                      </span>
                    </div>

                    {act.prompt && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                          Prompt / Task
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                          {act.prompt}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                        <span>Final Output Record</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(act.final_output);
                            toast.success('Final output copied to clipboard');
                          }}
                          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 normal-case cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-950 border border-cyan-500/20 text-xs text-zinc-100 whitespace-pre-wrap font-sans leading-relaxed">
                        {act.final_output}
                      </div>
                    </div>

                    {act.tool_calls && Array.isArray(act.tool_calls) && act.tool_calls.length > 0 && (
                      <details className="text-xs text-zinc-400">
                        <summary className="cursor-pointer hover:text-zinc-200 font-mono text-[11px]">
                          View {act.tool_calls.length} Tool Execution Traces
                        </summary>
                        <div className="mt-2 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 font-mono text-[11px] space-y-2 overflow-x-auto max-h-60 overflow-y-auto">
                          {act.tool_calls.map((tc, tcIdx) => (
                            <div key={tcIdx} className="border-b border-zinc-800/60 pb-2 last:border-0 last:pb-0">
                              <span className="text-cyan-400 font-semibold">{tc.name || 'tool'}</span>
                              <pre className="text-[10px] text-zinc-400 mt-1 overflow-x-auto">
                                {JSON.stringify(tc.result || tc.arguments, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

