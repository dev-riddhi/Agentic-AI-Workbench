"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  ArrowLeft,
  Sparkles,
  Cpu,
  Clock,
  Zap,
  Calendar,
  Shield,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { agentsApi } from '@/lib/api/agents';
import { modelsApi } from '@/lib/api/models';
import { documentsApi } from '@/lib/api/documents';
import { AIModelResponse, DocumentResponse, AgentTrigger } from '@/lib/api/types';
import { useToast } from '@/context/toast-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TOOL_CATEGORIES,
  WORKBENCH_TOOLS,
  PROMPT_STARTERS,
  ToolDefinition,
} from '@/lib/constants/tools';

const TRIGGER_OPTIONS: {
  id: AgentTrigger;
  label: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'manual',
    label: 'Manual Execution',
    badge: 'On-Demand',
    description: 'Triggered solely on-demand by authorized operators via Mission Console or API.',
    icon: Zap,
  },
  {
    id: 'schedule',
    label: 'Automated Schedule',
    badge: 'Recurring',
    description: 'Periodic background execution evaluated continuously by the scheduler daemon.',
    icon: Clock,
  },
  {
    id: 'onetime',
    label: 'One-Time Task',
    badge: 'Single Run',
    description: 'Fired exactly once at a pre-set calendar date and time, then gracefully retired.',
    icon: Calendar,
  },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Core Form State
  const [name, setName] = useState('Industrial Diagnostic Specialist');
  const [description, setDescription] = useState('Inspects equipment sensor logs, cross-references PDF manuals, and generates remediation reports.');
  const [instructions, setInstructions] = useState(PROMPT_STARTERS[0].prompt);
  const [modelId, setModelId] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([
    'parse_pdf',
    'read_file',
    'read_write_csv_excel_json_xml',
    'python_execution',
  ]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Trigger & Schedule State
  const [trigger, setTrigger] = useState<AgentTrigger>('schedule');
  const [scheduleInterval, setScheduleInterval] = useState<number>(1);
  const [scheduleUnit, setScheduleUnit] = useState<'hour' | 'day' | 'week'>('day');
  const [scheduleTime, setScheduleTime] = useState<string>('09:00');
  const [onetimeDate, setOnetimeDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [onetimeTime, setOnetimeTime] = useState<string>('09:00');

  // Advanced Execution Limits
  const [maxExecutionTime, setMaxExecutionTime] = useState<number>(15);
  const [maxToolCalls, setMaxToolCalls] = useState<number>(40);
  const [concurrency, setConcurrency] = useState<number>(1);
  const [retries, setRetries] = useState<number>(3);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(true);

  // Data Loading & Submission States
  const [models, setModels] = useState<AIModelResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Tool Category Filter for Builder UI
  const [activeToolCategory, setActiveToolCategory] = useState<string>('all');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [modelsData, docsData] = await Promise.allSettled([
          modelsApi.getModels(),
          documentsApi.getDocuments(),
        ]);

        if (modelsData.status === 'fulfilled' && modelsData.value && modelsData.value.length > 0) {
          setModels(modelsData.value);
          // Prefer loaded model or default to first
          const loadedModel = modelsData.value.find((m) => m.status === 'loaded') || modelsData.value[0];
          setModelId(loadedModel.id);
        }

        if (docsData.status === 'fulfilled' && docsData.value && docsData.value.length > 0) {
          setDocuments(docsData.value);
          // Auto-select first document if relevant
          if (docsData.value.length > 0) {
            setSelectedDocs([docsData.value[0].id]);
          }
        }
      } catch {
        // Handled silently
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Selected Model Object
  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === modelId) || null;
  }, [models, modelId]);

  // Dynamic Cron Expression Translation
  const cronExpression = useMemo(() => {
    if (trigger !== 'schedule') return null;
    const [hourStr, minStr] = scheduleTime.split(':');
    const h = parseInt(hourStr || '9', 10);
    const m = parseInt(minStr || '0', 10);

    if (scheduleUnit === 'hour') {
      return `0 */${scheduleInterval} * * *`;
    }
    if (scheduleUnit === 'day') {
      return `${m} ${h} */${scheduleInterval} * *`;
    }
    if (scheduleUnit === 'week') {
      return `${m} ${h} * * 1`; // Mondays
    }
    return `${m} ${h} * * *`;
  }, [trigger, scheduleInterval, scheduleUnit, scheduleTime]);

  const scheduleHumanSummary = useMemo(() => {
    if (trigger === 'manual') return 'Executes purely on operator dispatch';
    if (trigger === 'onetime') return `Single execution on ${onetimeDate} at ${onetimeTime} UTC`;
    return `Repeats every ${scheduleInterval} ${scheduleUnit}${scheduleInterval > 1 ? 's' : ''} at ${scheduleTime} UTC`;
  }, [trigger, scheduleInterval, scheduleUnit, scheduleTime, onetimeDate, onetimeTime]);

  // Validation Checks for Blueprint Checklist
  const validation = useMemo(() => {
    return {
      hasName: name.trim().length >= 3,
      hasInstructions: instructions.trim().length >= 15,
      hasModel: Boolean(modelId),
      hasTools: selectedTools.length > 0,
    };
  }, [name, instructions, modelId, selectedTools]);

  const isFormValid = validation.hasName && validation.hasInstructions && validation.hasModel && validation.hasTools;

  // Tool Selection Handlers
  const handleToolToggle = (toolName: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolName) ? prev.filter((t) => t !== toolName) : [...prev, toolName]
    );
  };

  const handleSelectAllCategory = (categoryTools: ToolDefinition[]) => {
    const categoryNames = categoryTools.map((t) => t.name);
    setSelectedTools((prev) => {
      const allPresent = categoryNames.every((n) => prev.includes(n));
      if (allPresent) {
        return prev.filter((n) => !categoryNames.includes(n));
      } else {
        return Array.from(new Set([...prev, ...categoryNames]));
      }
    });
  };

  const handleDocToggle = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((d) => d !== docId) : [...prev, docId]
    );
  };

  const applyPromptStarter = (starter: typeof PROMPT_STARTERS[0]) => {
    setInstructions(starter.prompt);
    setSelectedTools((prev) => Array.from(new Set([...prev, ...starter.recommendedTools])));
    toast.info(`Applied template: ${starter.title}`, 'Starter Loaded');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Agent identity name is required (min 3 chars).');
      return;
    }
    if (!instructions.trim()) {
      setError('System instructions prompt is required (min 15 chars).');
      return;
    }
    if (!modelId) {
      setError('A target local GGUF model must be assigned.');
      return;
    }
    if (selectedTools.length === 0) {
      setError('At least one autonomous capability tool must be enabled.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formattedSchedule =
      trigger === 'schedule'
        ? `Every ${scheduleInterval} ${scheduleUnit}${scheduleInterval > 1 ? 's' : ''} at ${scheduleTime}`
        : trigger === 'onetime'
        ? `Once on ${onetimeDate} at ${onetimeTime}`
        : undefined;

    try {
      const newAgent = await agentsApi.createAgent({
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim(),
        model_id: modelId,
        trigger,
        schedule: formattedSchedule,
        max_execution_time: maxExecutionTime,
        max_tool_calls: maxToolCalls,
        concurrency,
        retries,
        tools: selectedTools,
        document_ids: selectedDocs,
      });

      toast.success(`Autonomous Agent "${newAgent.name}" deployed to fleet!`, 'Agent Initialized');
      router.push(`/agents/${newAgent.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to deploy agent. Please verify parameters.';
      setError(msg);
      toast.error(msg, 'Deployment Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/agents"
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Autonomous Agent Builder</h1>
              <Badge variant="cyan">Studio v2.4</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Construct an air-gapped autonomous worker with deterministic tool permissions and local GGUF reasoning.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/agents')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormValid}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                <span>Deploying...</span>
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                <span>Deploy to Fleet</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Two-Column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Guided Configuration Steps (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* STEP 1: Identity & Persona */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                  01
                </div>
                <h2 className="text-sm font-bold text-zinc-100">Identity & Operational Persona</h2>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">Core Profile</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                  Agent Designation / Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Hydraulic Diagnostics Specialist"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                  Mission Description <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly state the agent's objective and domain boundaries..."
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {/* Quick Prompt Starters */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/60">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>PRESET SYSTEM TEMPLATES</span>
                </label>
                <span className="text-[10px] text-zinc-500">Click to apply template</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PROMPT_STARTERS.map((starter) => (
                  <button
                    key={starter.id}
                    type="button"
                    onClick={() => applyPromptStarter(starter)}
                    className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-cyan-500/40 hover:bg-zinc-900/60 text-left transition-all group cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-cyan-300 transition-colors">
                      {starter.title}
                    </div>
                    <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                      {starter.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Instructions Prompt Textarea */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                  System Instructions & Reasoning Directives <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] font-mono text-zinc-500">{instructions.length} chars</span>
              </div>
              <div className="relative">
                <textarea
                  rows={6}
                  required
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Define step-by-step reasoning constraints, tool call behaviors, and safety boundaries..."
                  className="w-full p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono leading-relaxed transition-colors"
                />
              </div>
              <p className="text-[10px] text-zinc-500">
                Instructions dictate the deterministic execution loop, parameter schemas, and error retry policy.
              </p>
            </div>
          </div>

          {/* STEP 2: Local GGUF Model Selector */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                  02
                </div>
                <h2 className="text-sm font-bold text-zinc-100">Local GGUF Model Runtime</h2>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">Air-Gapped LLM</span>
            </div>

            {isLoading ? (
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 animate-pulse text-xs text-zinc-500 font-mono text-center">
                Querying local llama-server engine...
              </div>
            ) : models.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {models.map((m) => {
                    const isSelected = modelId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModelId(m.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-cyan-500/10 border-cyan-500/60 shadow-sm shadow-cyan-500/10'
                            : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Cpu className={`w-4 h-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-zinc-500'}`} />
                            <span className="text-xs font-bold text-zinc-200 line-clamp-1">{m.name}</span>
                          </div>
                          <Badge variant={m.status === 'loaded' ? 'active' : 'offline'}>
                            {m.status === 'loaded' ? 'Active' : 'Standby'}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                          <span className="text-cyan-400/90">{m.quantization || 'Q4_K_M'}</span>
                          <span className="text-zinc-500">{m.context_window || 4096} ctx</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedModel && (
                  <div className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <span className="text-zinc-500">File:</span>
                      <span className="text-zinc-200 truncate max-w-xs">{selectedModel.filename}</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                      <span>Backend: <strong className="text-zinc-200">llama.cpp</strong></span>
                      <span>Loopback: <strong className="text-emerald-400">127.0.0.1:8000</strong></span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                <span>No local GGUF models registered. Please download or register a model first.</span>
                <Link href="/models" className="text-cyan-400 underline font-mono text-[11px]">
                  Go to Model Hub →
                </Link>
              </div>
            )}
          </div>

          {/* STEP 3: Trigger Engine & Visual Scheduler */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                  03
                </div>
                <h2 className="text-sm font-bold text-zinc-100">Trigger Engine & Scheduler</h2>
              </div>
              <span className="text-[11px] font-mono text-cyan-400">{trigger.toUpperCase()}</span>
            </div>

            {/* Trigger Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TRIGGER_OPTIONS.map((opt) => {
                const isSelected = trigger === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setTrigger(opt.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/60 text-zinc-100 shadow-sm shadow-cyan-500/10'
                        : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-zinc-500'}`} />
                        <span className="text-xs font-bold text-zinc-200">{opt.label}</span>
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-zinc-700 bg-zinc-950'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-400 leading-relaxed">{opt.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Visual Interval Scheduler */}
            {trigger === 'schedule' && (
              <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Recurring Cadence Controls
                  </span>
                  {cronExpression && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-cyan-400">
                      Cron: {cronExpression}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
                  <span className="font-mono text-zinc-400">REPEAT EVERY</span>
                  <input
                    type="number"
                    min={1}
                    value={scheduleInterval}
                    onChange={(e) => setScheduleInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-100 text-center font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <select
                    value={scheduleUnit}
                    onChange={(e) => setScheduleUnit(e.target.value as 'hour' | 'day' | 'week')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="hour">Hours</option>
                    <option value="day">Days</option>
                    <option value="week">Weeks</option>
                  </select>

                  <span className="font-mono text-zinc-400 ml-2">AT TIME</span>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-zinc-500 font-mono">UTC</span>
                </div>

                <div className="text-[11px] font-mono text-cyan-300/80 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                  Preview: {scheduleHumanSummary}
                </div>
              </div>
            )}

            {/* One-Time Execution Scheduler */}
            {trigger === 'onetime' && (
              <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/25 space-y-3">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  Target Execution Date & Time
                </span>

                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
                  <span className="font-mono text-zinc-400">EXECUTE ON</span>
                  <input
                    type="date"
                    value={onetimeDate}
                    onChange={(e) => setOnetimeDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="font-mono text-zinc-400">AT</span>
                  <input
                    type="time"
                    value={onetimeTime}
                    onChange={(e) => setOnetimeTime(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="text-[11px] font-mono text-cyan-300/80 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                  Preview: {scheduleHumanSummary}
                </div>
              </div>
            )}
          </div>

          {/* STEP 4: Comprehensive 19-Tool Permission Matrix */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                  04
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-100">Tool Permission Matrix (19 Tools)</h2>
                  <p className="text-[11px] text-zinc-400">
                    Grant fine-grained capabilities to this agent. All calls execute deterministically.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400 font-semibold">
                  {selectedTools.length} of {WORKBENCH_TOOLS.length} Granted
                </span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
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

            {/* Tool Groups Accordion */}
            <div className="space-y-4 pt-2">
              {TOOL_CATEGORIES.filter(
                (cat) => activeToolCategory === 'all' || activeToolCategory === cat.id
              ).map((category) => {
                const allSelected = category.tools.every((t) => selectedTools.includes(t.name));
                const countSelected = category.tools.filter((t) => selectedTools.includes(t.name)).length;

                return (
                  <div key={category.id} className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800/60 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-zinc-200">{category.title}</span>
                        <span className="text-[11px] text-zinc-500 ml-2 hidden sm:inline">
                          — {category.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-zinc-400">
                          {countSelected}/{category.tools.length} active
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectAllCategory(category.tools)}
                          className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {category.tools.map((tool) => {
                        const isChecked = selectedTools.includes(tool.name);
                        const Icon = tool.icon;

                        return (
                          <div
                            key={tool.id}
                            onClick={() => handleToolToggle(tool.name)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 select-none ${
                              isChecked
                                ? 'bg-cyan-500/10 border-cyan-500/40 text-zinc-100 shadow-sm shadow-cyan-500/5'
                                : 'bg-zinc-900/40 border-zinc-800/70 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                isChecked
                                  ? 'bg-cyan-500 border-cyan-500 text-zinc-950'
                                  : 'border-zinc-700 bg-zinc-950 text-transparent'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isChecked ? 'text-cyan-400' : 'text-zinc-500'}`} />
                                  <span className="text-xs font-semibold text-zinc-200 truncate">{tool.displayName}</span>
                                </div>
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase shrink-0 ${
                                    tool.riskLevel === 'safe'
                                      ? 'text-emerald-400 bg-emerald-500/10'
                                      : tool.riskLevel === 'medium'
                                      ? 'text-amber-400 bg-amber-500/10'
                                      : 'text-rose-400 bg-rose-500/10'
                                  }`}
                                >
                                  {tool.riskLevel}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">
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
                );
              })}
            </div>
          </div>

          {/* STEP 5: Knowledge Vault & RAG Documents */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                  05
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-100">Knowledge Vault (RAG Grounding)</h2>
                  <p className="text-[11px] text-zinc-400">
                    Attach ingested documents and technical manuals for semantic vector search.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-cyan-400">
                {selectedDocs.length} Attached
              </span>
            </div>

            {documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {documents.map((doc) => {
                  const isAttached = selectedDocs.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleDocToggle(doc.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isAttached
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                          : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <FileText className={`w-4 h-4 shrink-0 ${isAttached ? 'text-cyan-400' : 'text-zinc-500'}`} />
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-zinc-200 block truncate">{doc.name}</span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {doc.chunk_count || 12} vectors · {doc.file_type || 'PDF'}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                          isAttached ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'bg-zinc-900 text-zinc-500'
                        }`}
                      >
                        {isAttached ? 'Attached' : 'Exclude'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-dashed border-zinc-800 text-xs text-zinc-500 font-mono text-center">
                No indexed documents in Knowledge Vault. Upload PDF manuals in Knowledge Vault anytime.
              </div>
            )}
          </div>

          {/* STEP 6: Safety Constraints & Execution Limits */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-left cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                  06
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-100 group-hover:text-cyan-300 transition-colors">
                    Safety Constraints & Resource Limits
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Defend against infinite loops and throttle concurrent thread consumption.
                  </p>
                </div>
              </button>
              <ChevronDown
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`w-4 h-4 text-zinc-400 cursor-pointer transition-transform duration-200 ${
                  showAdvanced ? 'rotate-180' : ''
                }`}
              />
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    MAXIMUM EXECUTION TIMEOUT
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={maxExecutionTime}
                      onChange={(e) => setMaxExecutionTime(Math.max(1, parseInt(e.target.value) || 15))}
                      className="w-full px-3 py-2 pr-12 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <span className="absolute right-3 text-zinc-500 text-xs font-mono pointer-events-none">
                      min
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Worker hard kills at timeout threshold.</span>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    MAXIMUM TOOL CALL BUDGET
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={maxToolCalls}
                    onChange={(e) => setMaxToolCalls(Math.max(1, parseInt(e.target.value) || 40))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Prevents runaway recursive tool invocations.</span>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    CONCURRENCY THREADS
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={concurrency}
                    onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Simultaneous runs allowed on queue.</span>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    AUTOMATIC ERROR RETRIES
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={retries}
                    onChange={(e) => setRetries(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Re-attempts before marking run as Failed.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky "Live Agent Blueprint" Review Card (4 cols) */}
        <div className="lg:col-span-4 sticky top-20 space-y-4">
          <div className="glass-card p-5 space-y-4 border-cyan-500/20 shadow-xl shadow-cyan-950/20">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-zinc-200">
                  Agent Blueprint
                </h3>
              </div>
              <Badge variant="cyan">Ready to Build</Badge>
            </div>

            {/* Agent Preview Header */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-zinc-100 truncate">{name || 'Unnamed Agent'}</div>
                  <div className="text-[10px] font-mono text-zinc-400">Trigger: {trigger.toUpperCase()}</div>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2 italic">
                &ldquo;{description || 'No description provided'}&rdquo;
              </p>
            </div>

            {/* Model & Runtime Spec */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
                <span className="text-zinc-500">ASSIGNED MODEL</span>
                <span className="text-cyan-400 font-semibold truncate max-w-[160px]">
                  {selectedModel ? selectedModel.name : 'None Selected'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
                <span className="text-zinc-500">TRIGGER CADENCE</span>
                <span className="text-zinc-200 text-[11px] truncate max-w-[160px]">
                  {trigger === 'manual' ? 'On-Demand' : scheduleHumanSummary}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
                <span className="text-zinc-500">ENABLED TOOLS</span>
                <span className="text-emerald-400 font-semibold">
                  {selectedTools.length} of {WORKBENCH_TOOLS.length}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
                <span className="text-zinc-500">KNOWLEDGE DOCS</span>
                <span className="text-zinc-200">
                  {selectedDocs.length} attached
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
                <span className="text-zinc-500">SAFETY LIMITS</span>
                <span className="text-zinc-300 text-[11px]">
                  {maxExecutionTime}m max · {maxToolCalls} tools
                </span>
              </div>
            </div>

            {/* Readiness Checklist */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                Readiness Verification
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      validation.hasName ? 'text-emerald-400' : 'text-zinc-600'
                    }`}
                  />
                  <span className={validation.hasName ? 'text-zinc-300' : 'text-zinc-600'}>
                    Agent designation specified
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      validation.hasInstructions ? 'text-emerald-400' : 'text-zinc-600'
                    }`}
                  />
                  <span className={validation.hasInstructions ? 'text-zinc-300' : 'text-zinc-600'}>
                    System instructions formulated ({instructions.length} chars)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      validation.hasModel ? 'text-emerald-400' : 'text-zinc-600'
                    }`}
                  />
                  <span className={validation.hasModel ? 'text-zinc-300' : 'text-zinc-600'}>
                    Local GGUF model assigned
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      validation.hasTools ? 'text-emerald-400' : 'text-zinc-600'
                    }`}
                  />
                  <span className={validation.hasTools ? 'text-zinc-300' : 'text-zinc-600'}>
                    At least one tool authorized
                  </span>
                </div>
              </div>
            </div>

            {/* Action Deployment Button */}
            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                className="w-full justify-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                    <span>Deploying to Fleet...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    <span>Deploy Agent to Fleet</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
