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
  Sliders,
} from 'lucide-react';
import { Agent, AgentRunResponse, AIModelResponse, DocumentResponse, AgentTrigger } from '@/lib/api/types';
import { agentsApi } from '@/lib/api/agents';
import { modelsApi } from '@/lib/api/models';
import { documentsApi } from '@/lib/api/documents';
import { useToast } from '@/context/toast-context';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: Array<{ name?: string; arguments?: Record<string, unknown>; result?: unknown }>;
  status?: string;
}

const STEP_STAGES = [
  { key: 'reading', label: 'Reading Documents' },
  { key: 'searching', label: 'Searching Knowledge' },
  { key: 'analyzing', label: 'Analyzing Telemetry' },
  { key: 'done', label: 'Completed' },
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
      content: 'Agent workspace active. Submit a prompt or diagnostic query to execute tasks via the backend runtime.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('idle');
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<AgentRunResponse[]>([]);

  // Configuration Form State
  const [configName, setConfigName] = useState('');
  const [configDesc, setConfigDesc] = useState('');
  const [configInstructions, setConfigInstructions] = useState('');
  const [configModelId, setConfigModelId] = useState('');
  const [configTools, setConfigTools] = useState<string[]>([]);
  const [configTrigger, setConfigTrigger] = useState<AgentTrigger>('manual');
  const [configSchedule, setConfigSchedule] = useState('');
  const [configMaxExecutionTime, setConfigMaxExecutionTime] = useState(10);
  const [configMaxToolCalls, setConfigMaxToolCalls] = useState(50);
  const [configConcurrency, setConfigConcurrency] = useState(1);
  const [configRetries, setConfigRetries] = useState(3);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);

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
        setConfigMaxExecutionTime(ag.max_execution_time ?? 10);
        setConfigMaxToolCalls(ag.max_tool_calls ?? 50);
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

  // Execute Agent Prompt via Real Backend API
  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
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

    const stepTimer1 = setTimeout(() => setCurrentStep('searching'), 300);
    const stepTimer2 = setTimeout(() => setCurrentStep('analyzing'), 600);

    try {
      // Execute through FastAPI backend POST /api/v1/agents/{id}/run
      const response = await agentsApi.runAgent(id, userText);
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
      };

      setMessages((prev) => [...prev, agentMsg]);
      toast.success('Agent execution completed successfully.', 'Task Executed');
    } catch (err: unknown) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setCurrentStep('idle');

      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Agent run execution failed on backend API.';
      toast.error(detail, 'Execution Error');

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'system',
          content: `[Backend Error] ${detail}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsExecuting(false);
      setTimeout(() => setCurrentStep('idle'), 2500);
    }
  };

  // Stop Execution via Real Backend API
  const handleStopExecution = async () => {
    if (!isExecuting) return;
    try {
      await agentsApi.stopAgent(id, activeExecutionId || undefined);
      setAgent((prev) => (prev ? { ...prev, is_running: false } : null));
      toast.info('Agent execution stopped by operator.', 'Run Stopped');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to stop execution on backend';
      toast.error(detail, 'Stop Error');
    } finally {
      setIsExecuting(false);
      setCurrentStep('idle');
      setMessages((prev) => [
        ...prev,
        {
          id: `stop-${Date.now()}`,
          role: 'system',
          content: 'Execution stopped by operator signal.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Save Configuration (Tab 2) via Real Backend API
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await agentsApi.updateAgent(id, {
        name: configName,
        description: configDesc,
        instructions: configInstructions,
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
      toast.success('Agent configuration updated in database.', 'Configuration Saved');
      setTimeout(() => setConfigSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update agent configuration in backend';
      toast.error(detail, 'Update Failed');
    }
  };

  // Toggle Tool in Tools Tab via Real Backend API
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

  // Unlink Knowledge Document via Real Backend API
  const handleUnlinkDoc = async (docId: string, docName?: string) => {
    if (!agent) return;
    const ok = await confirm({
      title: 'Unlink Document',
      message: `Unlink "${docName || 'document'}" from this agent? The document remains available in the Knowledge Vault.`,
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
      toast.success('Document unlinked from agent.', 'Document Unlinked');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to unlink document';
      toast.error(detail, 'Error');
    }
  };

  // Link Knowledge Document via Real Backend API
  const handleLinkDoc = async (doc: DocumentResponse) => {
    if (!agent) return;
    const nextDocIds = [...(agent.documents || []).map((d) => d.id), doc.id];
    try {
      const updated = await agentsApi.updateAgent(id, { document_ids: nextDocIds });
      setAgent(updated);
      toast.success(`Attached "${doc.name}" to agent.`, 'Knowledge Attached');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to attach document';
      toast.error(detail, 'Error');
    }
  };

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !agent) {
    return (
      <div className="p-12 text-center rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-zinc-100">Agent Not Found in Backend</h3>
        <p className="text-xs text-zinc-400">
          The requested agent UUID does not exist in the database or belongs to another user.
        </p>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Fleet Catalog</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Agent Header */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/agents"
            className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-100">{agent.name}</h2>
              {agent.is_running && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Running
                </span>
              )}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {agent.model || agent.ai_model?.name || 'Local GGUF'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 capitalize">
                {agent.trigger === 'onetime' ? 'one-time' : (agent.trigger || 'manual')}
              </span>
              {agent.schedule && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {agent.schedule}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xl">
              {agent.description || 'Agent Workspace Active'}
            </p>
          </div>
        </div>

        {/* Quick Tabs Bar */}
        <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-medium overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Chat / Run
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'config'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Configuration
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'tools'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Tools ({configTools.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('knowledge')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'knowledge'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Knowledge ({agent.documents?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Runs ({executionLogs.length})
          </button>
        </div>
      </div>

      {/* TAB 1: CHAT / RUN WORKSPACE */}
      {activeTab === 'chat' && (
        <div className="space-y-4">
          {/* Real-time Execution Stepper */}
          {currentStep !== 'idle' && (
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-cyan-500/30 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                    Agent Pipeline Active:
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

              <button
                type="button"
                onClick={handleStopExecution}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
                Stop Run
              </button>
            </div>
          )}

          {/* Chat Messages Container */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 min-h-[460px] max-h-[580px] overflow-y-auto space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const isSystem = msg.role === 'system';

                if (isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-center text-xs text-zinc-400 font-mono"
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
                      <span>{isUser ? 'Operator' : agent.name}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-2xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-cyan-600 text-white rounded-br-xs'
                          : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Tool Call Inspector Accordion */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1.5">
                          <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            Tool Invocations ({msg.toolCalls.length})
                          </div>
                          {msg.toolCalls.map((tc, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-[11px] font-mono text-zinc-300 space-y-1"
                            >
                              <div className="text-cyan-300 font-semibold">
                                › {tc.name || 'document_search'}
                              </div>
                              {tc.arguments && (
                                <div className="text-zinc-500">
                                  Args: {JSON.stringify(tc.arguments)}
                                </div>
                              )}
                              {Boolean(tc.result) && (
                                <div className="text-emerald-400">
                                  Result: {String(tc.result)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Form Bar */}
            <form onSubmit={handleSendPrompt} className="relative pt-4">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isExecuting}
                  placeholder="Send instructions to agent via FastAPI runner..."
                  className="w-full pl-4 pr-24 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-50"
                />

                <div className="absolute right-2 flex items-center gap-1.5">
                  {isExecuting ? (
                    <button
                      type="button"
                      onClick={handleStopExecution}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-xs font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!prompt.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-30 cursor-pointer flex items-center gap-1"
                    >
                      <span>Run</span>
                      <Send className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: CONFIGURATION */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Agent Configuration</h3>
              <p className="text-xs text-zinc-400">
                Update identity, instructions, and target local model in backend database
              </p>
            </div>
            {configSaveSuccess && (
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                ✓ Changes Saved to Backend
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
              AGENT NAME
            </label>
            <input
              type="text"
              required
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
              DESCRIPTION
            </label>
            <input
              type="text"
              value={configDesc}
              onChange={(e) => setConfigDesc(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
              SYSTEM INSTRUCTIONS (PROMPT)
            </label>
            <textarea
              rows={4}
              required
              value={configInstructions}
              onChange={(e) => setConfigInstructions(e.target.value)}
              className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
              ASSIGNED LOCAL MODEL (GGUF)
            </label>
            <select
              value={configModelId}
              onChange={(e) => setConfigModelId(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.quantization || 'GGUF'}) - {m.filename}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
              TRIGGER
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['manual', 'schedule', 'onetime'] as AgentTrigger[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setConfigTrigger(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-mono capitalize border transition-all cursor-pointer ${
                    configTrigger === t
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40 font-bold'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {t === 'onetime' ? 'one-time' : t}
                </button>
              ))}
            </div>
          </div>

          {(configTrigger === 'schedule' || configTrigger === 'onetime') && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
                {configTrigger === 'schedule' ? 'SCHEDULE' : 'ONE-TIME EXECUTION'}
              </label>
              <input
                type="text"
                value={configSchedule}
                onChange={(e) => setConfigSchedule(e.target.value)}
                placeholder={
                  configTrigger === 'schedule'
                    ? 'e.g. Every 1 day at 09:00'
                    : 'e.g. Once on 2026-09-05 at 09:00'
                }
                className="w-full px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          )}

          <div className="pt-2 border-t border-zinc-800/80 space-y-3">
            <label className="block text-xs font-bold text-zinc-200 font-mono uppercase">
              Advanced Execution Settings
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Maximum execution time (min)
                </label>
                <input
                  type="number"
                  min={1}
                  value={configMaxExecutionTime}
                  onChange={(e) => setConfigMaxExecutionTime(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Maximum tool calls
                </label>
                <input
                  type="number"
                  min={1}
                  value={configMaxToolCalls}
                  onChange={(e) => setConfigMaxToolCalls(parseInt(e.target.value) || 50)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Concurrency
                </label>
                <input
                  type="number"
                  min={1}
                  value={configConcurrency}
                  onChange={(e) => setConfigConcurrency(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Retries
                </label>
                <input
                  type="number"
                  min={0}
                  value={configRetries}
                  onChange={(e) => setConfigRetries(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              Save Configuration to Backend
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: TOOLS PERMISSION MATRIX */}
      {activeTab === 'tools' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Tool Permissions Matrix</h3>
            <p className="text-xs text-zinc-400">
              Control the operational capabilities granted to this agent via backend API
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                id: 'document_search',
                name: 'document_search',
                desc: 'Searches vector-embedded company manuals and documentation',
              },
              {
                id: 'file_reader',
                name: 'file_reader',
                desc: 'Accesses uploaded raw text, pdf, and markdown documents',
              },
              {
                id: 'python_calculator',
                name: 'python_calculator',
                desc: 'Executes mathematical formulas and engineering conversions',
              },
              {
                id: 'internal_api',
                name: 'internal_api',
                desc: 'Dispatches read requests to internal manufacturing REST endpoints',
              },
            ].map((tool) => {
              const hasTool = configTools.includes(tool.name);
              return (
                <div
                  key={tool.id}
                  onClick={() => handleToggleTool(tool.name)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    hasTool
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs font-mono text-zinc-100">
                      {tool.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        hasTool
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {hasTool ? 'Granted' : 'Revoked'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{tool.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: KNOWLEDGE ATTACHMENTS */}
      {activeTab === 'knowledge' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Attached Knowledge Documents</h3>
            <p className="text-xs text-zinc-400">
              Indexed company documents available for this agent&apos;s RAG search
            </p>
          </div>

          <div className="space-y-3">
            {agent.documents && agent.documents.length > 0 ? (
              agent.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">{doc.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {doc.mime_type || 'PDF Document'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnlinkDoc(doc.id, doc.name)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    Unlink
                  </button>
                </div>
              ))
            ) : (
              <div className="p-6 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs text-zinc-500">
                No documents currently attached to this agent.
              </div>
            )}
          </div>

          {/* Attach from Vault */}
          <div className="pt-4 border-t border-zinc-800">
            <h4 className="text-xs font-bold font-mono text-zinc-400 uppercase mb-3">
              Available in Knowledge Vault
            </h4>
            {allDocs.filter((d) => !agent.documents?.some((ad) => ad.id === d.id)).length === 0 ? (
              <div className="text-xs text-zinc-500 font-mono">
                All vault documents are already attached, or no documents uploaded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allDocs
                  .filter((d) => !agent.documents?.some((ad) => ad.id === d.id))
                  .map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs"
                    >
                      <span className="truncate text-zinc-300">{d.name}</span>
                      <button
                        type="button"
                        onClick={() => handleLinkDoc(d)}
                        className="px-2 py-1 rounded bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 text-[11px] font-medium cursor-pointer"
                      >
                        + Attach
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: EXECUTION LOG */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Live Execution Audit Trail</h3>
            <p className="text-xs text-zinc-400">
              Audit log of real prompts dispatched to this agent via backend API
            </p>
          </div>

          {executionLogs.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs text-zinc-500">
              No executions run in this session yet. Type a prompt in the Chat tab to execute on the backend runtime.
            </div>
          ) : (
            <div className="space-y-3">
              {executionLogs.map((log) => (
                <div
                  key={log.execution_id}
                  className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="text-cyan-400 font-bold">Execution ID: {log.execution_id}</span>
                    <span className="text-emerald-400 font-semibold">● {log.status}</span>
                  </div>
                  <div className="text-zinc-300 font-sans text-xs">{log.response}</div>
                  <div className="text-[10px] text-zinc-600">
                    Completed at: {new Date(log.completed_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
