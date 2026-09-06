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
} from 'lucide-react';
import { Agent, AgentRunResponse, AIModelResponse, DocumentResponse, AgentTrigger } from '@/lib/api/types';
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
  { key: 'reading', label: 'Ingesting Context' },
  { key: 'searching', label: 'Vector RAG Search' },
  { key: 'analyzing', label: 'Local LLM Reasoning' },
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

  const [activeTab, setActiveTab] = useState<'chat' | 'config' | 'tools' | 'knowledge' | 'logs'>(
    initialTab === 'config' || initialTab === 'tools' || initialTab === 'knowledge' || initialTab === 'logs'
      ? initialTab
      : 'chat'
  );

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

      if (agentRes.status === 'fulfilled' && agentRes.value) {
        const ag = agentRes.value;
        setAgent(ag);
        setConfigName(ag.name);
        setConfigDesc(ag.description || '');
        setConfigInstructions(ag.instructions);
        setConfigModelId(ag.model_id);
        setConfigTools(ag.tools?.map((t) => t.name) || []);
        setConfigTrigger(ag.trigger || 'manual');
        setConfigSchedule(ag.schedule || '');
        setConfigMaxExecutionTime(ag.max_execution_time ?? 15);
        setConfigMaxToolCalls(ag.max_tool_calls ?? 40);
        setConfigConcurrency(ag.concurrency ?? 1);
        setConfigRetries(ag.retries ?? 3);
      } else {
        setNotFound(true);
      }

      if (modelsRes.status === 'fulfilled') {
        setModels(modelsRes.value || []);
      }
      if (docsRes.status === 'fulfilled') {
        setAllDocs(docsRes.value || []);
      }
      setIsLoading(false);
    });

    return () => {
      active = false;
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

  // Execute Agent Prompt via Backend API
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

    setMessages((prev) => [...prev, userMsg]);
    setIsExecuting(true);
    setCurrentStep('reading');

    const stepTimer1 = setTimeout(() => setCurrentStep('searching'), 350);
    const stepTimer2 = setTimeout(() => setCurrentStep('analyzing'), 750);
    const startTime = performance.now();

    try {
      const response = await agentsApi.runAgent(id, userText);
      const elapsed = Math.round(performance.now() - startTime);

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setCurrentStep('done');
      setActiveExecutionId(response.execution_id);

      setExecutionLogs((prev) => [response, ...prev]);

      const agentMsg: ChatMessage = {
        id: response.execution_id,
        role: 'agent',
        content: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCalls: response.tool_calls,
        status: response.status,
        latencyMs: elapsed,
      };

      setMessages((prev) => [...prev, agentMsg]);
      toast.success(`Mission executed successfully in ${elapsed}ms.`, 'Task Completed');
    } catch (err: unknown) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setCurrentStep('idle');

      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Agent execution failed on backend runtime. Check logs.';
      toast.error(detail, 'Execution Error');

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'system',
          content: `[Execution Error] ${detail}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsExecuting(false);
      setTimeout(() => setCurrentStep('idle'), 2500);
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
              <Bot className="w-3.5 h-3.5" />
              <span>Mission Feed</span>
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
              <span>Parameters</span>
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
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Audit Runs ({executionLogs.length})</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-zinc-500">
            <span>Air-Gapped: <strong className="text-emerald-400">0.0 KB Egress</strong></span>
            <span>·</span>
            <span>Host: <strong className="text-zinc-300">127.0.0.1:8000</strong></span>
          </div>
        </div>
      </div>

      {/* TAB 1: MISSION FEED & LIVE EXECUTION STUDIO */}
      {activeTab === 'chat' && (
        <div className="space-y-4">
          {/* Active Execution Pipeline Indicator */}
          {currentStep !== 'idle' && (
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-cyan-500/30 flex items-center justify-between animate-in fade-in shadow-lg shadow-cyan-950/20">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                    PIPELINE ACTIVE:
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {STEP_STAGES.map((st, i) => {
                      const isPassed =
                        currentStep === 'done' ||
                        (currentStep === 'searching' && i === 0) ||
                        (currentStep === 'analyzing' && i <= 1);
                      const isCurrent = currentStep === st.key;

                      return (
                        <span
                          key={st.key}
                          className={`flex items-center gap-1 ${
                            isCurrent
                              ? 'text-cyan-300 font-bold'
                              : isPassed
                              ? 'text-emerald-400'
                              : 'text-zinc-600'
                          }`}
                        >
                          {isPassed ? '✓' : isCurrent ? '●' : '○'} {st.label}
                          {i < STEP_STAGES.length - 1 && <span className="text-zinc-700">→</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Button
                variant="danger"
                size="sm"
                onClick={handleStopExecution}
                className="gap-1.5 h-7 px-2.5 text-xs"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Abort</span>
              </Button>
            </div>
          )}

          {/* Chat Messages Feed Container */}
          <div className="glass-card p-5 min-h-[460px] max-h-[620px] overflow-y-auto space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              {messages.map((msg) => {
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
                      <span>{isUser ? 'Authorized Operator' : agent.name}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                      {msg.latencyMs !== undefined && (
                        <span className="text-cyan-400/80">({msg.latencyMs}ms)</span>
                      )}
                    </div>

                    <div
                      className={`max-w-2xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed relative group ${
                        isUser
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-xs shadow-md shadow-cyan-950/30'
                          : 'bg-zinc-900/90 text-zinc-100 border border-zinc-800 rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap font-sans">{msg.content}</p>

                      {/* Copy Action Overlay */}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-950/60 hover:bg-zinc-950 text-zinc-400 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
                              Tool Traces ({msg.toolCalls.length} Invocations)
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {msg.toolCalls.map((tc, idx) => {
                              const accordionKey = `${msg.id}-tc-${idx}`;
                              const isExpanded = Boolean(expandedToolCalls[accordionKey]);

                              return (
                                <div
                                  key={idx}
                                  className="rounded-xl bg-zinc-950/80 border border-zinc-800/90 overflow-hidden text-xs font-mono"
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleToolCallAccordion(accordionKey)}
                                    className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-zinc-900/50 transition-colors cursor-pointer"
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
                                            Arguments:
                                          </span>
                                          <pre className="p-2 rounded-lg bg-zinc-900 text-zinc-300 text-[11px] overflow-x-auto">
                                            {JSON.stringify(tc.arguments, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                      {Boolean(tc.result) && (
                                        <div>
                                          <span className="text-[10px] uppercase text-zinc-500 block mb-0.5">
                                            Result Output:
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
              })}
            </div>

            {/* Input Bar with Ctrl+Enter shortcut */}
            <form onSubmit={handleSendPrompt} className="pt-4 border-t border-zinc-800/80">
              <div className="relative flex flex-col gap-2">
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isExecuting}
                  placeholder="Dispatch instructions or diagnostic query (Press Ctrl+Enter to send)..."
                  className="w-full p-3.5 pr-24 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-sans transition-colors resize-none disabled:opacity-50"
                />

                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>Tip: Press <strong>Ctrl + Enter</strong> to execute immediately</span>

                  <div className="flex items-center gap-2">
                    {isExecuting ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleStopExecution}
                        className="gap-1.5"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!prompt.trim()}
                        onClick={() => handleSendPrompt()}
                        className="gap-1.5"
                      >
                        <span>Dispatch</span>
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: INLINE AGENT CONFIGURATION */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Inline Agent Reconfiguration</h2>
              <p className="text-xs text-zinc-400">
                Modify persona, system directives, assigned GGUF weights, or safety constraints.
              </p>
            </div>
            {configSaveSuccess && (
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Parameters Persisted
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
                  <span>Save Configuration to Database</span>
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

      {/* TAB 5: EXECUTION AUDIT RUNS */}
      {activeTab === 'logs' && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Live Execution Audit Trail</h2>
              <p className="text-xs text-zinc-400">
                Cryptographic audit log of real tasks dispatched to this agent on the backend runtime.
              </p>
            </div>
            <Badge variant="cyan">{executionLogs.length} Executions Recorded</Badge>
          </div>

          {executionLogs.length === 0 ? (
            <div className="p-10 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs text-zinc-500 font-mono">
              No executions logged during this session yet. Dispatch a task in the Mission Feed to record execution traces.
            </div>
          ) : (
            <div className="space-y-3">
              {executionLogs.map((log) => (
                <div
                  key={log.execution_id}
                  className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs font-mono space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-cyan-400 font-bold">EXECUTION ID: {log.execution_id}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                        ● {log.status}
                      </span>
                      <span className="text-zinc-500">
                        {new Date(log.completed_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-zinc-300 font-sans text-xs bg-zinc-900/70 p-3 rounded-lg border border-zinc-800/60 whitespace-pre-wrap">
                    {log.response}
                  </div>

                  {log.tool_calls && log.tool_calls.length > 0 && (
                    <div className="text-[11px] text-zinc-400 space-y-1">
                      <span className="text-zinc-500 uppercase text-[10px]">Tools Triggered:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {log.tool_calls.map((tc, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-zinc-900 text-cyan-300 border border-zinc-800"
                          >
                            {tc.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
