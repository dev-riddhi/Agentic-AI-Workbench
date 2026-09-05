"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  Cpu,
  Sparkles,
  Bot,
  User,
  Sliders,
  RefreshCw,
  Terminal,
  ChevronDown,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Square,
} from 'lucide-react';
import { chatApi, ConversationResponse, ConversationSummary, ChatMessage } from '@/lib/api/chat';
import { modelsApi } from '@/lib/api/models';
import { runtimeApi } from '@/lib/api/runtime';
import { AIModelResponse, ModelRuntimeStatus } from '@/lib/api/types';
import { useToast } from '@/context/toast-context';

const QUICK_STARTERS = [
  {
    title: "Code Assistant",
    prompt: "Write a high-performance Python function using asyncio to process tasks concurrently with rate limiting.",
  },
  {
    title: "System Architecture",
    prompt: "Explain the pros and cons of local edge GGUF inference versus centralized cloud API LLM deployments.",
  },
  {
    title: "Reasoning & Logic",
    prompt: "If 5 machines take 5 minutes to make 5 widgets, how long do 100 machines take to make 100 widgets? Explain step by step.",
  },
  {
    title: "Data Diagnostic",
    prompt: "Help me write a regex pattern to parse structured JSON log lines containing timestamps, log levels, and error codes.",
  },
];

function ChatContent() {
  const searchParams = useSearchParams();
  const targetModelId = searchParams.get('modelId');
  const { toast, confirm } = useToast();

  // State
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [currentConv, setCurrentConv] = useState<ConversationResponse | null>(null);
  const [models, setModels] = useState<AIModelResponse[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [runtimeStatus, setRuntimeStatus] = useState<ModelRuntimeStatus | null>(null);

  // Layout states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Loading states
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingConv, setIsLoadingConv] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Input & configuration state
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful, sovereign, and concise local AI assistant.'
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSending(false);
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load single conversation
  const loadConversation = useCallback(async (convId: string) => {
    setActiveConvId(convId);
    setIsLoadingConv(true);
    try {
      const conv = await chatApi.getConversation(convId);
      setCurrentConv(conv);
      if (conv.model_id) {
        setSelectedModelId(conv.model_id);
      }
    } catch {
      toast.error('Failed to fetch conversation details', 'Error');
    } finally {
      setIsLoadingConv(false);
    }
  }, [toast]);

  // Auto-scroll to bottom of message list
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [currentConv?.messages, isSending]);

  // Initial Load: Models, Runtime Status & Conversations
  useEffect(() => {
    let active = true;

    // Load available models
    modelsApi.getModels()
      .then((data) => {
        if (!active) return;
        setModels(data || []);
        if (targetModelId && data.some((m) => m.id === targetModelId)) {
          setSelectedModelId(targetModelId);
        } else if (data.length > 0) {
          setSelectedModelId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load models:', err);
      });

    // Check runtime daemon
    runtimeApi.getModelStatus()
      .then((st) => {
        if (active) setRuntimeStatus(st);
      })
      .catch(() => {});

    // Load conversations
    chatApi.listConversations()
      .then((convs) => {
        if (!active) return;
        setConversations(convs);
        if (convs.length > 0) {
          loadConversation(convs[0].id);
        }
      })
      .catch(() => {
        toast.error('Failed to load chat conversations history', 'Network Error');
      })
      .finally(() => {
        if (active) setIsLoadingList(false);
      });

    return () => {
      active = false;
    };
  }, [targetModelId, toast, loadConversation]);

  // Start a new conversation
  const handleStartNewChat = async (presetPrompt?: string) => {
    if (!selectedModelId) {
      toast.error('Please select or download a model first before starting a chat.', 'No Model Selected');
      return;
    }

    const selectedModel = models.find((m) => m.id === selectedModelId);
    const modelName = selectedModel ? selectedModel.name : 'AI Model';

    try {
      const newConv = await chatApi.createConversation({
        model_id: selectedModelId,
        title: `Chat with ${modelName}`,
        initial_message: presetPrompt || undefined,
        system_prompt: systemPrompt,
      });

      setConversations((prev) => [
        {
          id: newConv.id,
          model_id: newConv.model_id,
          model_name: modelName,
          title: newConv.title,
          message_count: newConv.messages.length,
          last_message: presetPrompt || null,
          created_at: newConv.created_at,
          updated_at: newConv.updated_at,
        },
        ...prev,
      ]);

      setCurrentConv(newConv);
      setActiveConvId(newConv.id);

      if (presetPrompt) {
        triggerSend(newConv.id, presetPrompt);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not initialize chat session';
      toast.error(msg, 'Chat Creation Failed');
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string, title: string | null) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete Conversation',
      message: `Are you sure you want to delete "${title || 'this conversation'}"? All message history will be permanently lost.`,
      confirmText: 'Yes, Delete',
      cancelText: 'Keep',
      danger: true,
    });

    if (!ok) return;

    try {
      await chatApi.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        const remaining = conversations.filter((c) => c.id !== convId);
        if (remaining.length > 0) {
          loadConversation(remaining[0].id);
        } else {
          setActiveConvId(null);
          setCurrentConv(null);
        }
      }
      toast.success('Conversation thread deleted.', 'Deleted');
    } catch {
      toast.error('Failed to delete conversation.', 'Error');
    }
  };

  // Core send message handler with real-time SSE streaming
  const triggerSend = async (convId: string, messageText: string) => {
    if (!messageText.trim() || isSending) return;

    const trimmedText = messageText.trim();
    const optimisticUserMessage: ChatMessage = {
      role: 'user',
      content: trimmedText,
      timestamp: new Date().toISOString(),
    };

    const optimisticAssistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    setCurrentConv((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, optimisticUserMessage, optimisticAssistantMessage],
      };
    });

    setInputMessage('');
    setIsSending(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await chatApi.streamMessage({
        conversationId: convId,
        payload: {
          message: trimmedText,
          system_prompt: systemPrompt,
          temperature,
          max_tokens: maxTokens,
        },
        signal: abortController.signal,
        onToken: (token: string) => {
          setCurrentConv((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            if (msgs.length === 0) return prev;
            const lastIdx = msgs.length - 1;
            const last = msgs[lastIdx];
            if (last && last.role === 'assistant') {
              msgs[lastIdx] = {
                ...last,
                content: (last.content || '') + token,
              };
            }
            return {
              ...prev,
              messages: msgs,
            };
          });
          scrollToBottom(true);
        },
        onComplete: (updatedConv: ConversationResponse) => {
          setCurrentConv(updatedConv);
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === convId) {
                return {
                  ...c,
                  title: updatedConv.title,
                  message_count: updatedConv.messages.length,
                  last_message: trimmedText,
                  updated_at: updatedConv.updated_at,
                };
              }
              return c;
            })
          );
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Stream generation error', 'Generation Failed');
          // If assistant message was never populated, prune the empty placeholder
          setCurrentConv((prev) => {
            if (!prev) return prev;
            const msgs = prev.messages.filter(
              (m, i) => !(i === prev.messages.length - 1 && m.role === 'assistant' && !m.content)
            );
            return { ...prev, messages: msgs };
          });
        },
      });
    } catch (err: unknown) {
      if (!abortController.signal.aborted) {
        const detail =
          (err as { message?: string })?.message ||
          'Inference failed communicating with model server.';
        toast.error(detail, 'Message Failed');
        setCurrentConv((prev) => {
          if (!prev) return prev;
          const msgs = prev.messages.filter(
            (m, i) => !(i === prev.messages.length - 1 && m.role === 'assistant' && !m.content)
          );
          return { ...prev, messages: msgs };
        });
      }
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || isSending) return;

    if (!activeConvId) {
      handleStartNewChat(inputMessage.trim());
    } else {
      triggerSend(activeConvId, inputMessage.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredConversations = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.model_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <div className="flex-1 flex min-h-0 w-full h-full overflow-hidden bg-zinc-950 select-none">
      {/* LEFT SIDEBAR: THREAD HISTORY (COLLAPSIBLE) */}
      <aside
        className={`h-full bg-zinc-950 flex flex-col shrink-0 min-h-0 transition-all duration-200 ease-in-out ${
          isSidebarOpen ? 'w-80 border-r border-zinc-800/80' : 'w-0 border-r-0 overflow-hidden'
        }`}
      >
        {isSidebarOpen && (
          <div className="flex flex-col h-full min-h-0">
            {/* Sidebar Top Header */}
            <div className="p-3.5 border-b border-zinc-800 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Conversations
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                    {conversations.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors cursor-pointer"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              {/* Primary "New Chat" Action */}
              <button
                type="button"
                onClick={() => handleStartNewChat()}
                disabled={models.length === 0}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/10 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>New Conversation</span>
              </button>

              {/* Search Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter threads..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            {/* Conversation Threads List */}
            <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
              {isLoadingList ? (
                <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading chat history...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-600 space-y-2">
                  <MessageSquare className="w-6 h-6 mx-auto opacity-30 text-zinc-500" />
                  <p>No conversations found.</p>
                  {models.length > 0 && (
                    <p className="text-[11px] text-zinc-500">Click &ldquo;New Conversation&rdquo; to start.</p>
                  )}
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`group relative p-2.5 rounded-xl cursor-pointer transition-all text-left ${
                        isActive
                          ? 'bg-zinc-900 border border-cyan-500/30 text-zinc-100 shadow-sm shadow-cyan-500/5'
                          : 'hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className="text-xs font-semibold truncate leading-tight flex-1">
                          {conv.title || 'Untitled Conversation'}
                        </h3>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteConversation(e, conv.id, conv.title)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 rounded transition-opacity cursor-pointer shrink-0"
                          title="Delete thread"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {conv.last_message && (
                        <p className="text-[11px] text-zinc-500 truncate mt-1 leading-snug">
                          {conv.last_message}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-800/40 text-[10px] text-zinc-500 font-mono">
                        <span className="truncate max-w-[120px] text-cyan-400/80">
                          {conv.model_name || 'Model'}
                        </span>
                        <span>{conv.message_count} msgs</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Bottom Footer */}
            <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80 shrink-0 flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>{models.length} Models Available</span>
              </span>
              <Link
                href="/models"
                className="text-cyan-400 hover:underline flex items-center gap-0.5"
              >
                <span>Hub &rarr;</span>
              </Link>
            </div>
          </div>
        )}
      </aside>

      {/* RIGHT MAIN AREA: ACTIVE CHAT PANE */}
      <section className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-zinc-950/40 relative">
        {/* TOP SUB-HEADER BAR */}
        <div className="h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-4 md:px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Sidebar Expand Button (when collapsed) */}
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                title="Open Conversation Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
              </button>
            )}

            {/* Model Selector Dropdown */}
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-[10px] font-mono text-zinc-400 hidden sm:inline uppercase tracking-wider shrink-0">
                Target Model:
              </label>
              <div className="relative shrink-0">
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700/70 text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 pr-7 appearance-none focus:outline-none focus:border-cyan-500 font-sans cursor-pointer max-w-[200px] sm:max-w-[260px] truncate"
                >
                  {models.length === 0 ? (
                    <option value="">No models installed</option>
                  ) : (
                    models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.quantization || m.format})
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Model Server Readiness Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] shrink-0">
              {runtimeStatus?.ready ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 font-medium">Server Ready</span>
                </>
              ) : runtimeStatus?.running ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-300 font-medium">Loading Weights...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span className="text-zinc-400">Standby</span>
                </>
              )}
            </div>

            {/* Live Streaming Indicator Chip */}
            {isSending && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-[11px] text-cyan-300 font-medium shrink-0 animate-pulse shadow-sm shadow-cyan-500/20">
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>Streaming...</span>
              </div>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                showConfig
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 font-medium'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title="Toggle inference parameters"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Parameters</span>
            </button>

            <Link
              href="/runtime"
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-xs flex items-center gap-1.5 transition-colors"
              title="Open Runtime Dashboard"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Telemetry</span>
            </Link>
          </div>
        </div>

        {/* COLLAPSIBLE GENERATION CONFIG DRAWER */}
        {showConfig && (
          <div className="p-4 bg-zinc-900/95 border-b border-zinc-800 text-xs space-y-3 animate-in slide-in-from-top-2 duration-150 shrink-0">
            <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Temperature:</span>
                  <span className="font-mono text-cyan-400 font-bold">{temperature}</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={1.5}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Max Tokens:</span>
                  <span className="font-mono text-cyan-400 font-bold">{maxTokens}</span>
                </div>
                <input
                  type="range"
                  min={128}
                  max={4096}
                  step={128}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">System Instructions:</label>
                <input
                  type="text"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are a helpful assistant..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* MESSAGE STREAM (SCROLLABLE FEED) */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-4">
          {isLoadingConv ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-zinc-500">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
                <span className="text-xs">Loading conversation...</span>
              </div>
            </div>
          ) : !currentConv || currentConv.messages.length === 0 ? (
            /* EMPTY STATE: QUICK STARTERS */
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-6 select-text">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-base md:text-lg font-bold text-zinc-100">
                  {currentConv?.title || (selectedModel ? `Chat with ${selectedModel.name}` : 'Local AI Model Chat')}
                </h2>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                  Direct reasoning session with local weights. Fully air-gapped, zero external network calls.
                </p>
              </div>

              {/* Starter cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                {QUICK_STARTERS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (activeConvId) {
                        triggerSend(activeConvId, item.prompt);
                      } else {
                        handleStartNewChat(item.prompt);
                      }
                    }}
                    className="p-3.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-cyan-500/30 transition-all text-left space-y-1 group cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-cyan-300 flex items-center justify-between">
                      <span>{item.title}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400">&rarr;</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* CONVERSATION MESSAGES */
            <div className="max-w-3xl w-full mx-auto space-y-5 select-text">
              {currentConv.messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 ${
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* User / Bot Avatar */}
                    <div
                      className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border shadow-sm ${
                        isUser
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                          : 'bg-gradient-to-tr from-cyan-600 to-blue-600 border-cyan-400/40 text-white'
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`rounded-2xl px-4 py-3 max-w-[85%] text-xs leading-relaxed space-y-1.5 shadow-sm ${
                        isUser
                          ? 'bg-cyan-600/10 border border-cyan-500/25 text-zinc-100 rounded-tr-xs'
                          : 'bg-zinc-900/90 border border-zinc-800 text-zinc-200 rounded-tl-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-zinc-500 mb-0.5">
                        <span className="font-semibold text-zinc-400 uppercase tracking-wider">
                          {isUser ? 'You' : currentConv.model_name || 'AI Assistant'}
                        </span>
                        {msg.latency_ms && (
                          <span className="text-cyan-400 flex items-center gap-0.5 font-mono text-[10px]">
                            <Zap className="w-2.5 h-2.5" />
                            {msg.latency_ms}ms
                          </span>
                        )}
                      </div>

                      {/* Message Content */}
                      {!msg.content && isSending && idx === currentConv.messages.length - 1 ? (
                        <div className="flex items-center gap-2 py-1 text-zinc-400 text-xs">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          <span className="text-zinc-400 font-mono text-[11px] ml-1">Synthesizing response...</span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap font-sans text-zinc-100 selection:bg-cyan-500/30">
                          {msg.content}
                          {isSending && idx === currentConv.messages.length - 1 && (
                            <span className="inline-block w-1.5 h-3.5 bg-cyan-400 ml-1 animate-pulse align-middle" />
                          )}
                        </div>
                      )}

                      {/* Footer: timestamps & badges */}
                      <div className="flex items-center justify-between pt-0.5 text-[9px] font-mono text-zinc-500">
                        {msg.interrupted ? (
                          <span className="text-amber-400/80 font-medium">Stopped by user</span>
                        ) : (
                          <span />
                        )}
                        {msg.timestamp && (
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* BOTTOM INPUT DOCK (FIXED AT BOTTOM) */}
        <div className="p-3 md:p-4 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 shrink-0">
          <div className="max-w-3xl w-full mx-auto space-y-2">
            <div className="relative rounded-2xl bg-zinc-900/90 border border-zinc-800 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all p-3 shadow-xl">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  models.length === 0
                    ? 'No models installed. Download a model from Model Hub first.'
                    : 'Message the AI model... (Enter to send, Shift+Enter for newline)'
                }
                disabled={models.length === 0 || isSending}
                rows={2}
                className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none disabled:opacity-50 font-sans leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                  <span>Shift + Enter for new line</span>
                  {inputMessage.length > 0 && <span>• {inputMessage.length} chars</span>}
                </div>

                <div className="flex items-center gap-2">
                  {isSending ? (
                    <button
                      type="button"
                      onClick={handleStopGenerating}
                      className="px-4 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-semibold shadow-md shadow-red-500/10 flex items-center gap-1.5 cursor-pointer transition-all animate-pulse"
                      title="Stop generating tokens"
                    >
                      <Square className="w-3 h-3 fill-red-400" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || models.length === 0}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 h-full bg-zinc-950 flex items-center justify-center text-zinc-500 text-xs font-mono">
          Initializing Chat Workspace...
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
