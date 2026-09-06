"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  ArrowLeft,
  FileText,
  AlertCircle,
  Clock,
  Zap,
  Calendar,
  Sliders,
  Database,
  FolderClosed,
  Check,
  ChevronDown,
  Wrench,
  Search,
  Globe,
  Terminal,
  FileArchive,
} from 'lucide-react';
import { agentsApi } from '@/lib/api/agents';
import { modelsApi } from '@/lib/api/models';
import { documentsApi } from '@/lib/api/documents';
import { AIModelResponse, DocumentResponse, AgentTrigger, AvailableTool } from '@/lib/api/types';
import { useToast } from '@/context/toast-context';

function getToolIcon(name: string): React.ComponentType<{ className?: string }> {
  const n = name.toLowerCase();
  if (n.includes('python') || n.includes('execution')) return Terminal;
  if (n.includes('web') || n.includes('browse') || n.includes('fetch') || n.includes('page') || n.includes('news')) return Globe;
  if (n.includes('search') || n.includes('find') || n.includes('image')) return Search;
  if (n.includes('zip') || n.includes('compress') || n.includes('extract')) return FileArchive;
  if (n.includes('file') || n.includes('directory')) return FolderClosed;
  if (n.includes('csv') || n.includes('excel') || n.includes('json') || n.includes('database')) return Database;
  if (n.includes('api')) return Zap;
  return Wrench;
}

const TRIGGER_OPTIONS: { id: AgentTrigger; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    id: 'manual',
    label: 'Manual',
    description: 'Executed on-demand by operator through chat or CLI',
    icon: Zap,
  },
  {
    id: 'schedule',
    label: 'Schedule',
    description: 'Automated periodic execution based on fixed time interval',
    icon: Clock,
  },
  {
    id: 'onetime',
    label: 'One-Time',
    description: 'Scheduled for single execution at a specified date and time',
    icon: Calendar,
  },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Core Form State
  const [name, setName] = useState('Daily Sales Analyst');
  const [instructions, setInstructions] = useState('Analyze the latest sales data and generate a summary...');
  const [modelId, setModelId] = useState('');
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [isToolsLoading, setIsToolsLoading] = useState(true);
  const [toolSearch, setToolSearch] = useState('');
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  
  // Trigger & Schedule State
  const [trigger, setTrigger] = useState<AgentTrigger>('schedule');
  const [scheduleInterval, setScheduleInterval] = useState<number>(1);
  const [scheduleUnit, setScheduleUnit] = useState<string>('day');
  const [scheduleTime, setScheduleTime] = useState<string>('09:00');
  const [onetimeDate, setOnetimeDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [onetimeTime, setOnetimeTime] = useState<string>('09:00');

  // Advanced State
  const [maxExecutionTime, setMaxExecutionTime] = useState<number>(10);
  const [maxToolCalls, setMaxToolCalls] = useState<number>(50);
  const [concurrency, setConcurrency] = useState<number>(1);
  const [retries, setRetries] = useState<number>(3);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(true);

  // Data Loading State
  const [models, setModels] = useState<AIModelResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setIsToolsLoading(true);
      try {
        const [modelsData, docsData, toolsData] = await Promise.allSettled([
          modelsApi.getModels(),
          documentsApi.getDocuments(),
          agentsApi.getAvailableTools(),
        ]);

        if (modelsData.status === 'fulfilled' && modelsData.value && modelsData.value.length > 0) {
          setModels(modelsData.value);
          // Prefer GPT-5.6 if found, otherwise first model
          const gpt = modelsData.value.find((m) => m.name.toLowerCase().includes('gpt-5.6') || m.name.toLowerCase().includes('gpt'));
          setModelId(gpt ? gpt.id : modelsData.value[0].id);
        }

        if (docsData.status === 'fulfilled' && docsData.value && docsData.value.length > 0) {
          setDocuments(docsData.value);
          // Prefer Sales Documents if found
          const salesDoc = docsData.value.find((d) => d.name.toLowerCase().includes('sales'));
          if (salesDoc) {
            setSelectedDocs([salesDoc.id]);
          }
        }

        if (toolsData.status === 'fulfilled' && toolsData.value && toolsData.value.length > 0) {
          setAvailableTools(toolsData.value);
          // Default select read_file and web_search if available
          const defaultSelected = toolsData.value
            .filter((t) => ['read_file', 'web_search'].includes(t.name))
            .map((t) => t.name);
          setSelectedTools(defaultSelected.length > 0 ? defaultSelected : [toolsData.value[0].name]);
        }
      } catch {
        // Handled
      } finally {
        setIsLoading(false);
        setIsToolsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleToolToggle = (toolName: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolName) ? prev.filter((t) => t !== toolName) : [...prev, toolName]
    );
  };

  const toggleToolExpanded = (toolName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedTools((prev) => ({
      ...prev,
      [toolName]: !prev[toolName],
    }));
  };

  const filteredTools = availableTools.filter((t) => {
    const q = toolSearch.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = t.name.toLowerCase().includes(q);
    const descMatch = (t.description || '').toLowerCase().includes(q);
    const paramMatch = Object.keys(t.parameters?.properties || {}).some((k) => k.toLowerCase().includes(q));
    return nameMatch || descMatch || paramMatch;
  });

  const handleSelectAllTools = () => {
    setSelectedTools(filteredTools.map((t) => t.name));
  };

  const handleDeselectAllTools = () => {
    setSelectedTools([]);
  };

  const handleDocToggle = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((d) => d !== docId) : [...prev, docId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }
    if (!instructions.trim()) {
      setError('System instructions are required');
      return;
    }
    if (!modelId) {
      setError('A target model must be selected');
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

      toast.success(`Agent "${newAgent.name}" created successfully!`, 'Agent Created');
      router.push(`/agents/${newAgent.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create agent on backend API. Verify parameters.';
      setError(msg);
      toast.error(msg, 'Creation Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/agents"
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            Create Agent
          </h2>
        </div>
      </div>

      <div className="border-t border-zinc-800" />

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Creation Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Name */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-zinc-200">
            Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Daily Sales Analyst"
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* 2. Instructions */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-zinc-200">
            Instructions
          </label>
          <textarea
            rows={4}
            required
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Analyze the latest sales data and generate a summary..."
            className="w-full p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-colors"
          />
        </div>

        {/* 3. Model */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-zinc-200">
            Model
          </label>
          <div className="relative">
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors cursor-pointer"
            >
              {models.length > 0 ? (
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))
              ) : (
                <option value="">No models available (register one first)</option>
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 4. Tools & Capabilities */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="block text-sm font-semibold text-zinc-200">
                Tools & Capabilities
              </label>
              <p className="text-[11px] text-zinc-400">
                Select tools granted to this agent. Expand any tool to inspect parameter schemas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {selectedTools.length} of {availableTools.length} selected
              </span>
              <button
                type="button"
                onClick={handleSelectAllTools}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleDeselectAllTools}
                className="text-[11px] text-zinc-400 hover:text-zinc-300 font-mono px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Tool Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={toolSearch}
              onChange={(e) => setToolSearch(e.target.value)}
              placeholder="Search tools by name, description, or parameter..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
            />
          </div>

          {/* Tools List */}
          {isToolsLoading ? (
            <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              Loading available tools from backend...
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center text-xs text-zinc-500 font-mono">
              {availableTools.length === 0
                ? 'No tools available from backend.'
                : `No tools match "${toolSearch}".`}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredTools.map((tool) => {
                const isChecked = selectedTools.includes(tool.name);
                const isExpanded = !!expandedTools[tool.name];
                const Icon = getToolIcon(tool.name);
                const properties = tool.parameters?.properties || {};
                const propKeys = Object.keys(properties);
                const requiredList = tool.parameters?.required || [];

                return (
                  <div
                    key={tool.id || tool.name}
                    className={`rounded-xl border transition-all ${
                      isChecked
                        ? 'bg-zinc-900/90 border-cyan-500/40 shadow-sm shadow-cyan-500/5'
                        : 'bg-zinc-900/50 border-zinc-800/90 hover:border-zinc-700'
                    }`}
                  >
                    {/* Tool Header Row */}
                    <div
                      onClick={() => handleToolToggle(tool.name)}
                      className="p-3 flex items-start gap-3 cursor-pointer select-none"
                    >
                      <div
                        className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-cyan-500 border-cyan-500 text-zinc-950'
                            : 'border-zinc-700 bg-zinc-950 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>

                      <div className="p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 shrink-0 mt-0.5">
                        <Icon className={`w-3.5 h-3.5 ${isChecked ? 'text-cyan-400' : 'text-zinc-500'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-zinc-200 font-mono">
                            {tool.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
                            {propKeys.length} {propKeys.length === 1 ? 'param' : 'params'}
                          </span>
                          {requiredList.length > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              {requiredList.length} required
                            </span>
                          )}
                        </div>
                        {tool.description && (
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                            {tool.description}
                          </p>
                        )}
                      </div>

                      {/* Expand Parameters Button */}
                      <button
                        type="button"
                        onClick={(e) => toggleToolExpanded(tool.name, e)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors shrink-0 flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                        title={isExpanded ? 'Hide parameters' : 'Show parameters'}
                      >
                        <span>Params</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Collapsible Parameter Details View */}
                    {isExpanded && (
                      <div className="px-4 pb-3.5 pt-2 border-t border-zinc-800/80 bg-zinc-950/60 rounded-b-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold font-mono text-zinc-300 uppercase tracking-wider">
                            Parameter Schema Details
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            Type: {tool.parameters?.type || 'object'}
                          </span>
                        </div>

                        {propKeys.length === 0 ? (
                          <p className="text-xs text-zinc-500 font-mono italic">
                            No parameters required for this tool.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {propKeys.map((key) => {
                              const prop = properties[key] || {};
                              const isRequired = requiredList.includes(key);
                              return (
                                <div
                                  key={key}
                                  className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs space-y-1"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono font-semibold text-cyan-300">
                                      {key}
                                    </span>
                                    <span
                                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                        isRequired
                                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                          : 'bg-zinc-800 text-zinc-400'
                                      }`}
                                    >
                                      {isRequired ? 'required' : 'optional'}
                                    </span>
                                    {prop.type && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                                        {prop.type}
                                      </span>
                                    )}
                                    {prop.default !== undefined && (
                                      <span className="text-[10px] font-mono text-zinc-400">
                                        default: <span className="text-zinc-200">{String(prop.default)}</span>
                                      </span>
                                    )}
                                    {prop.enum && (
                                      <span className="text-[10px] font-mono text-zinc-400">
                                        options: [{prop.enum.join(', ')}]
                                      </span>
                                    )}
                                  </div>
                                  {prop.description && (
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                                      {prop.description}
                                    </p>
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
              })}
            </div>
          )}
        </div>

        {/* 5. Knowledge */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-zinc-200">
            Knowledge
          </label>
          {documents.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {documents.map((doc) => {
                  const isAttached = selectedDocs.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleDocToggle(doc.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isAttached
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="text-xs font-medium truncate">{doc.name}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                          isAttached ? 'bg-cyan-500/20 text-cyan-300' : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {isAttached ? 'Selected' : 'Exclude'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-dashed border-zinc-800 text-xs text-zinc-500 font-mono text-center">
              No knowledge documents ingested yet. Upload documents in Knowledge Vault anytime.
            </div>
          )}
        </div>

        {/* 6. Trigger */}
        <div className="space-y-2.5">
          <label className="block text-sm font-semibold text-zinc-200">
            Trigger
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {TRIGGER_OPTIONS.map((opt) => {
              const isSelected = trigger === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setTrigger(opt.id)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200 shadow-sm shadow-cyan-500/10'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-zinc-500'}`} />
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-zinc-700 bg-zinc-950'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-100">{opt.label}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{opt.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 7. Schedule / One-Time Execution */}
        {trigger === 'schedule' && (
          <div className="space-y-2.5 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
            <label className="block text-sm font-semibold text-zinc-200">
              Schedule
            </label>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
              <span className="font-medium">Every</span>
              <input
                type="number"
                min={1}
                value={scheduleInterval}
                onChange={(e) => setScheduleInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-center font-mono focus:outline-none focus:border-cyan-500"
              />
              <select
                value={scheduleUnit}
                onChange={(e) => setScheduleUnit(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="day">day</option>
                <option value="week">week</option>
                <option value="month">month</option>
                <option value="hour">hour</option>
              </select>
              <span className="font-medium">at</span>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {trigger === 'onetime' && (
          <div className="space-y-2.5 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
            <label className="block text-sm font-semibold text-zinc-200">
              One-Time Execution Schedule
            </label>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
              <span className="font-medium">Run once on</span>
              <input
                type="date"
                value={onetimeDate}
                onChange={(e) => setOnetimeDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="font-medium">at</span>
              <input
                type="time"
                value={onetimeTime}
                onChange={(e) => setOnetimeTime(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {/* 8. Advanced */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-200 hover:text-white cursor-pointer transition-colors"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Advanced</span>
            <ChevronDown
              className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                showAdvanced ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Maximum execution time
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min={1}
                    value={maxExecutionTime}
                    onChange={(e) => setMaxExecutionTime(Math.max(1, parseInt(e.target.value) || 10))}
                    className="w-full px-3 py-2 pr-12 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="absolute right-3 text-zinc-500 text-xs font-mono pointer-events-none">
                    min
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Maximum tool calls
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxToolCalls}
                  onChange={(e) => setMaxToolCalls(Math.max(1, parseInt(e.target.value) || 50))}
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
                  value={concurrency}
                  onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))}
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
                  value={retries}
                  onChange={(e) => setRetries(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* 9. Action Button */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !modelId}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-40"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating Agent...</span>
              </span>
            ) : (
              <span>Create Agent</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
