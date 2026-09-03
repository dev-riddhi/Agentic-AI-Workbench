"use client";

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Info,
  Sparkles,
} from 'lucide-react';
import { AIModelResponse } from '@/lib/api/types';
import { modelsApi } from '@/lib/api/models';
import { useToast } from '@/context/toast-context';

export default function ModelsPage() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'downloaded' | 'hf'>('downloaded');
  const [models, setModels] = useState<AIModelResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state - Start completely empty (use hints/placeholders)
  const [repoId, setRepoId] = useState('');
  const [filename, setFilename] = useState('');
  const [modelName, setModelName] = useState('');
  const [quantization, setQuantization] = useState('');
  const [background, setBackground] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    modelsApi.getModels()
      .then((data) => {
        if (active) setModels(data || []);
      })
      .catch((err: unknown) => {
        if (active) {
          const detail =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
            'Failed to fetch models from backend API.';
          toast.error(detail, 'API Error');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [toast]);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete GGUF Model',
      message: `Delete model "${name}" from local storage? You will need to re-download the binary if needed again.`,
      confirmText: 'Yes, Delete Model',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    try {
      await modelsApi.deleteModel(id);
      setModels((prev) => prev.filter((m) => m.id !== id));
      toast.success(`Model "${name}" deleted from disk.`, 'Model Deleted');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete model from backend API.';
      toast.error(detail, 'Delete Error');
    }
  };

  const handleDownloadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate .gguf requirement per backend specification
    if (!filename.trim().endsWith('.gguf')) {
      setValidationError('Validation Error: Only validated .gguf files are accepted by the backend runtime.');
      return;
    }

    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const result = await modelsApi.downloadModel(
        {
          repo_id: repoId.trim(),
          filename: filename.trim(),
          name: (modelName.trim() || filename.trim()),
          quantization: quantization.trim() || undefined,
        },
        background
      );

      setModels((prev) => [result, ...prev]);
      setDownloadSuccess(true);
      toast.success(`Download request accepted by backend for ${filename}.`, 'Download Triggered');
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to initiate model download on backend API.';
      setValidationError(detail);
      toast.error(detail, 'Download Failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            Local Model Hub (GGUF Quantizations)
          </h2>
          <p className="text-xs text-zinc-400">
            Air-gapped LLM runtimes for zero external network dependency during agent execution
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('downloaded')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'downloaded'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Downloaded Models ({models.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hf')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'hf'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Hugging Face Downloader
          </button>
        </div>
      </div>

      {/* TAB 1: DOWNLOADED MODELS */}
      {activeTab === 'downloaded' && (
        <div>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-2">
              <Cpu className="w-8 h-8 text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-zinc-300">No GGUF models registered in backend</div>
              <p className="text-xs text-zinc-500">
                Download a model using the Hugging Face Downloader tab to enable agent execution.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-100">{m.name}</h3>
                        <p className="text-xs text-zinc-500 font-mono truncate max-w-sm mt-0.5">
                          {m.repo_id}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {m.quantization || 'Q4_K_M'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs font-mono space-y-1 text-zinc-400">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">File:</span>
                        <span className="text-zinc-200 truncate max-w-[220px]">{m.filename}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Size:</span>
                        <span className="text-zinc-200">
                          {m.size_bytes ? `${(m.size_bytes / (1024 * 1024)).toFixed(0)} MB` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Status:</span>
                        <span className="text-emerald-400 uppercase">{m.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      In-Memory Ready
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDelete(m.id, m.name)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HUGGING FACE DOWNLOADER */}
      {activeTab === 'hf' && (
        <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-zinc-100">Import GGUF Quantization</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Dispatches download requests to the FastAPI backend model management worker.
            </p>
          </div>

          {/* Sample Hint Card */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold font-mono text-[11px]">
                <Info className="w-3.5 h-3.5" />
                SAMPLE GGUF REPOSITORY HINT
              </span>
              <button
                type="button"
                onClick={() => {
                  setRepoId('TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF');
                  setFilename('tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf');
                  setModelName('TinyLlama 1.1B Chat (Q4_K_M)');
                  setQuantization('Q4_K_M');
                }}
                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                <span>Fill sample hint</span>
              </button>
            </div>
            <div className="text-[11px] text-zinc-400 leading-relaxed font-mono space-y-0.5">
              <div>Repo: <code className="text-zinc-300">TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF</code></div>
              <div>File: <code className="text-zinc-300">tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf</code></div>
            </div>
          </div>

          {validationError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {downloadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Model download registered with FastAPI backend!</span>
            </div>
          )}

          <form onSubmit={handleDownloadSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
                HUGGING FACE REPO ID *
              </label>
              <input
                type="text"
                required
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                placeholder="e.g. TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF"
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
                GGUF FILENAME * (Must end in .gguf)
              </label>
              <input
                type="text"
                required
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g. tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
                  DISPLAY NAME
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. TinyLlama 1.1B"
                  className="w-full px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
                  QUANTIZATION
                </label>
                <input
                  type="text"
                  value={quantization}
                  onChange={(e) => setQuantization(e.target.value)}
                  placeholder="e.g. Q4_K_M"
                  className="w-full px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={background}
                onChange={(e) => setBackground(e.target.checked)}
                className="rounded border-zinc-700 text-cyan-500 focus:ring-cyan-500"
              />
              <span>Download via backend BackgroundTasks worker (Recommended)</span>
            </label>

            <button
              type="submit"
              disabled={isDownloading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {isDownloading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connecting to FastAPI Backend...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Dispatch Download via Backend</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
