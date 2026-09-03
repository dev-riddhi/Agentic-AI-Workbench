"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  ArrowLeft,
  FileText,
  Save,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { agentsApi } from '@/lib/api/agents';
import { modelsApi } from '@/lib/api/models';
import { documentsApi } from '@/lib/api/documents';
import { AIModelResponse, DocumentResponse } from '@/lib/api/types';
import { useToast } from '@/context/toast-context';

const AVAILABLE_TOOLS = [
  {
    id: 'document_search',
    name: 'document_search',
    description: 'Searches embedded documents in vector database using semantic similarity',
  },
  {
    id: 'file_reader',
    name: 'file_reader',
    description: 'Reads and extracts full text directly from uploaded files',
  },
  {
    id: 'python_calculator',
    name: 'python_calculator',
    description: 'Executes mathematical calculations and sensor telemetry formulas',
  },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [modelId, setModelId] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  const [models, setModels] = useState<AIModelResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setModelId(modelsData.value[0].id);
        }

        if (docsData.status === 'fulfilled' && docsData.value && docsData.value.length > 0) {
          setDocuments(docsData.value);
        }
      } catch {
        // Handled
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleToolToggle = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    );
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
      setError('A local GGUF model must be selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newAgent = await agentsApi.createAgent({
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim(),
        model_id: modelId,
        tools: selectedTools,
        document_ids: selectedDocs,
      });

      toast.success(`Agent "${newAgent.name}" created successfully in backend!`, 'Agent Provisioned');
      router.push(`/agents/${newAgent.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Failed to create agent on backend API. Verify parameters.';
      setError(msg);
      toast.error(msg, 'Creation Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/agents"
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            Provision Sovereign Agent
          </h2>
          <p className="text-xs text-zinc-400">
            Configure system prompt, assign on-premise model weights, and grant tool permissions
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Model Prerequisite Warning */}
      {!isLoading && models.length === 0 && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
          <div className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            No Local GGUF Models Found in Database
          </div>
          <p className="text-zinc-400">
            An agent requires a valid local AI model. Please download or register a GGUF model in the Model Hub first.
          </p>
          <Link
            href="/models"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 font-medium"
          >
            Go to Model Hub →
          </Link>
        </div>
      )}

      {/* Main Provisioning Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Identity */}
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-zinc-100 border-b border-zinc-800/80 pb-3">
            1. Identity & Role
          </h3>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
              AGENT NAME *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hydraulic Diagnostic Assistant"
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
              DESCRIPTION
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of agent's operational domain..."
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-300 font-mono">
                SYSTEM INSTRUCTIONS (PROMPT) *
              </label>
              <button
                type="button"
                onClick={() =>
                  setInstructions(
                    'You are an industrial diagnostic assistant. Analyze telemetry readings, cross-reference equipment manuals, and diagnose equipment faults.'
                  )
                }
                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                <span>Use sample hint</span>
              </button>
            </div>
            <textarea
              rows={4}
              required
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. You are an industrial diagnostic assistant. Analyze telemetry readings, cross-reference equipment manuals, and diagnose equipment faults."
              className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* Section 2: Model Weights */}
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h3 className="text-sm font-bold text-zinc-100">
              2. On-Premise Model Weights (GGUF)
            </h3>
            <span className="text-[10px] font-mono text-cyan-400">Zero-Egress Execution</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
              ASSIGNED MODEL *
            </label>
            {models.length > 0 ? (
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.quantization || 'GGUF'}) — {m.filename}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-500 font-mono">
                No local models available. Please download a model from Model Hub.
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Tool Permissions */}
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-zinc-100 border-b border-zinc-800/80 pb-3">
            3. Operational Tools Permission Matrix
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {AVAILABLE_TOOLS.map((tool) => {
              const isSelected = selectedTools.includes(tool.id);
              return (
                <div
                  key={tool.id}
                  onClick={() => handleToolToggle(tool.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                      : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs font-mono text-zinc-100">
                      {tool.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {isSelected ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{tool.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 4: Knowledge Attachments */}
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-zinc-100 border-b border-zinc-800/80 pb-3">
            4. Knowledge Vault Documents (Optional)
          </h3>

          {documents.length === 0 ? (
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-500 text-center font-mono">
              No documents ingested into the vault yet. You can link documents anytime later in the Agent Workspace.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {documents.map((doc) => {
                const isSelected = selectedDocs.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleDocToggle(doc.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                        : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-200 truncate">{doc.name}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                        isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {isSelected ? 'Attached' : 'Exclude'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Form Action */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/agents"
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || models.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-40"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Provisioning on Backend...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Provision Agent</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
