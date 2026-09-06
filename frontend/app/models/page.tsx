"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Sparkles,
  Upload,
  FileUp,
  FileText,
  X,
  MessageSquare,
  ShieldCheck,
  Search,
  RefreshCw,
} from 'lucide-react';
import { AIModelResponse, LlamaServerStatusResponse } from '@/lib/api/types';
import { modelsApi } from '@/lib/api/models';
import { useToast } from '@/context/toast-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';

const POPULAR_GGUF_PRESETS = [
  {
    name: 'TinyLlama 1.1B Chat',
    repoId: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
    filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    quantization: 'Q4_K_M',
    sizeApprox: '669 MB',
    desc: 'Ultra-lightweight local reasoning model ideal for quick diagnostics and edge runtimes.',
  },
  {
    name: 'Phi-3 Mini 3.8B Instruct',
    repoId: 'microsoft/Phi-3-mini-4k-instruct-gguf',
    filename: 'Phi-3-mini-4k-instruct-q4.gguf',
    quantization: 'Q4_K_M',
    sizeApprox: '2.39 GB',
    desc: 'State-of-the-art small language model with outstanding structured tool calling accuracy.',
  },
  {
    name: 'Llama-3.2 1B Instruct',
    repoId: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    quantization: 'Q4_K_M',
    sizeApprox: '800 MB',
    desc: 'Compact multilingual reasoning model from Meta with 128k context capabilities.',
  },
  {
    name: 'Mistral 7B Instruct v0.3',
    repoId: 'MaziyarPanahi/Mistral-7B-Instruct-v0.3-GGUF',
    filename: 'Mistral-7B-Instruct-v0.3.Q4_K_M.gguf',
    quantization: 'Q4_K_M',
    sizeApprox: '4.37 GB',
    desc: 'High-throughput reasoning powerhouse supporting native function calling and JSON schemas.',
  },
];

export default function ModelsPage() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'downloaded' | 'upload' | 'hf'>('downloaded');
  const [models, setModels] = useState<AIModelResponse[]>([]);
  const [serverStatus, setServerStatus] = useState<LlamaServerStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // HuggingFace Form state
  const [repoId, setRepoId] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    model_id: string;
    repo_id?: string;
    filename?: string;
    name?: string;
    quantization?: string;
    status: string;
    downloaded_bytes: number;
    total_bytes: number;
    percent: number;
    speed?: string | null;
    error?: string | null;
  } | null>(null);

  // Local Device Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [customUploadName, setCustomUploadName] = useState('');
  const [customUploadQuant, setCustomUploadQuant] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadModelsData = async () => {
    setIsLoading(true);
    try {
      const data = await modelsApi.checkLlamaStatus();
      setServerStatus(data);
      setModels(data.models || []);
    } catch {
      try {
        const fallbackData = await modelsApi.getModels();
        setModels(fallbackData || []);
      } catch (err: unknown) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Failed to fetch models from backend API.';
        toast.error(detail, 'API Error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadModelsData();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete GGUF Model',
      message: `Delete model "${name}" from local storage? You will need to re-download or re-upload the binary if needed again.`,
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

    const cleanRepo = repoId.trim();
    if (!cleanRepo) {
      setValidationError('Please specify a Hugging Face Repository ID (e.g. TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF).');
      return;
    }

    setIsDownloading(true);
    setDownloadSuccess(false);
    setDownloadProgress({
      model_id: '',
      repo_id: cleanRepo,
      status: 'downloading',
      downloaded_bytes: 0,
      total_bytes: 0,
      percent: 0,
      speed: null,
    });

    try {
      const result = await modelsApi.downloadModel(
        {
          repo_id: cleanRepo,
        },
        true
      );

      setModels((prev) => [result, ...prev.filter((m) => m.id !== result.id)]);
      toast.info(`Download registered with backend. Polling live progress...`, 'Download Started');

      // Poll progress every 800ms
      const pollInterval = setInterval(async () => {
        try {
          const prog = await modelsApi.getDownloadProgress(result.id);
          setDownloadProgress(prog);

          if (prog.status === 'ready') {
            clearInterval(pollInterval);
            setIsDownloading(false);
            setDownloadSuccess(true);
            toast.success(
              `Model "${prog.name || result.name}" successfully downloaded and inspected via GGUFReader!`,
              'Model Ready'
            );

            // Refresh models list from server
            modelsApi.checkLlamaStatus().then((data) => {
              setServerStatus(data);
              if (data.models) setModels(data.models);
            }).catch(() => {});

            setTimeout(() => {
              setDownloadSuccess(false);
              setDownloadProgress(null);
              setActiveTab('downloaded');
            }, 2500);
          } else if (prog.status === 'failed') {
            clearInterval(pollInterval);
            setIsDownloading(false);
            const errMsg = prog.error || 'Hugging Face download failed on the backend worker.';
            setValidationError(errMsg);
            toast.error(errMsg, 'Download Failed');
          }
        } catch {
          // Keep polling until completed or failed
        }
      }, 800);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to initiate model download on backend API.';
      setValidationError(detail);
      toast.error(detail, 'Download Failed');
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const applyPreset = (preset: (typeof POPULAR_GGUF_PRESETS)[0]) => {
    setRepoId(preset.repoId);
    toast.info(`Selected ${preset.name} (${preset.repoId})`, 'Preset Selected');
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gguf')) {
      setUploadError('Invalid File: Only .gguf model files are accepted for local upload.');
      setUploadFile(null);
      return;
    }

    setUploadError(null);
    setUploadFile(file);
    setCustomUploadName(file.name.replace(/\.gguf$/i, ''));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a .gguf model file from your device.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const created = await modelsApi.uploadModel(
        uploadFile,
        customUploadName.trim() || undefined,
        customUploadQuant.trim() || undefined,
        (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      );

      setModels((prev) => [created, ...prev.filter((m) => m.id !== created.id)]);
      setUploadSuccess(true);
      toast.success(`Model "${created.name}" uploaded successfully and ready for runtime execution!`, 'Model Uploaded');
      setUploadFile(null);
      setCustomUploadName('');
      setCustomUploadQuant('');

      // Refresh server status and model inventory
      modelsApi.checkLlamaStatus().then((data) => {
        setServerStatus(data);
        if (data.models) setModels(data.models);
      }).catch(() => {});

      setTimeout(() => {
        setUploadSuccess(false);
        setActiveTab('downloaded');
      }, 1500);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to upload model file to backend storage.';
      setUploadError(detail);
      toast.error(detail, 'Upload Failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const totalModelBytes = models.reduce((acc, m) => acc + (m.size_bytes || 0), 0);

  const filteredModels = models.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.filename && m.filename.toLowerCase().includes(q)) ||
      (m.repo_id && m.repo_id.toLowerCase().includes(q)) ||
      (m.quantization && m.quantization.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span>Local Model Hub</span>
            <Badge variant="cyan" size="sm" className="font-mono">
              {models.length} Models
            </Badge>
            <Badge variant="active" size="sm" className="font-mono">
              Air-Gapped GGUF
            </Badge>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Zero-egress quantized language model repository powering local llama-server reasoning
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void loadModelsData();
            }}
            isLoading={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Link href="/runtime">
            <Button variant="ghost" size="sm" className="text-xs text-cyan-600 dark:text-cyan-300">
              Runtime Controls &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {/* Telemetry Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Registered Models</span>
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5 block">{models.length} Binaries</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Disk Footprint</span>
          <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400 font-mono mt-0.5 block">{formatFileSize(totalModelBytes)}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Server Engine</span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
            {serverStatus?.installed ? 'llama.cpp Ready' : 'Standby'}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Local Runtime</span>
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-mono mt-0.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            127.0.0.1:8080
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar (Agent Page Style) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 rounded-2xl bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 backdrop-blur-md shadow-sm">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('downloaded')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'downloaded'
                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Model Catalog</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
              {models.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Local GGUF</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hf')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'hf'
                ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Hugging Face Hub</span>
            {downloadProgress && downloadProgress.status === 'downloading' && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500" />
              </span>
            )}
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models, files, quant..."
            className="w-full pl-10 pr-4 py-1.5 rounded-xl bg-white dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
          />
        </div>
      </div>

      {/* Llama.cpp Status Notice */}
      {serverStatus && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border text-xs ${
            serverStatus.installed
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {serverStatus.installed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {serverStatus.installed ? 'llama.cpp Server Binary Verified' : serverStatus.message || 'llama.cpp is not installed'}
              </span>
              <span className="hidden sm:inline text-zinc-400 dark:text-zinc-600">|</span>
              <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[11px] truncate max-w-md">
                {serverStatus.server_path || '/backend/llama.cpp/bin/Release/llama-server.exe'}
              </span>
            </div>
          </div>
          <Link href="/runtime">
            <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2.5 text-cyan-700 dark:text-cyan-300 font-medium">
              <span>Runtime Controls &rarr;</span>
            </Button>
          </Link>
        </div>
      )}

      {/* TAB 1: DOWNLOADED MODELS */}
      {activeTab === 'downloaded' && (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : models.length === 0 ? (
            <div className="p-12 text-center rounded-2xl glass-card border border-dashed border-zinc-300 dark:border-zinc-800 space-y-3">
              <Cpu className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No GGUF models registered in local storage</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Upload a pre-quantized .gguf model from your machine or dispatch a download from Hugging Face.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="primary" size="sm" onClick={() => setActiveTab('upload')} className="gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Local GGUF</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setActiveTab('hf')} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span>Hugging Face Presets</span>
                </Button>
              </div>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="p-12 text-center rounded-2xl glass-card border border-dashed border-zinc-300 dark:border-zinc-800 space-y-3">
              <Search className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No models match &quot;{search}&quot;</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Try searching by different model parameters, quantizations, or clear the filter query.
              </p>
              <div className="pt-2">
                <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                  Clear Filter
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredModels.map((m) => (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl glass-card flex flex-col justify-between space-y-4 hover:border-cyan-500/40 transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                          {m.name}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-sm mt-0.5">
                          {m.repo_id || 'Local Binary Ingestion'}
                        </p>
                      </div>
                      <Badge variant="cyan">{m.quantization || 'Q4_K_M'}</Badge>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 text-xs font-mono space-y-1.5 text-zinc-600 dark:text-zinc-400">
                      <div className="flex justify-between">
                        <span className="text-zinc-400 dark:text-zinc-500">FILENAME:</span>
                        <span className="text-zinc-800 dark:text-zinc-200 truncate max-w-[220px]">{m.filename}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 dark:text-zinc-500">SIZE ON DISK:</span>
                        <span className="text-zinc-800 dark:text-zinc-200">{formatFileSize(m.size_bytes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 dark:text-zinc-500">STATUS:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 uppercase font-semibold">
                          ● {m.status || 'Ready'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 dark:text-zinc-500">CONTEXT:</span>
                        <span className="text-zinc-800 dark:text-zinc-300">{m.context_window || 4096} tokens</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800/80 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      In-Memory Capable
                    </span>

                    <div className="flex items-center gap-2">
                      <Link href={`/chat?modelId=${m.id}`}>
                        <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs gap-1">
                          <MessageSquare className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                          <span>Chat</span>
                        </Button>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDelete(m.id, m.name)}
                        className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete GGUF Model"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UPLOAD LOCAL GGUF MODEL */}
      {activeTab === 'upload' && (
        <div className="glass-card p-8 max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Upload GGUF Model from Local Device
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Select any quantized model binary (`.gguf`) from your machine to upload and register directly into backend storage.
            </p>
          </div>

          {uploadError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">Model uploaded and registered successfully in backend!</span>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-5">
            <input
              type="file"
              ref={fileInputRef}
              accept=".gguf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />

            {!uploadFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className={`p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-500/10 scale-[1.01]'
                    : 'border-zinc-300 dark:border-zinc-700/80 hover:border-cyan-500/50 bg-zinc-50/50 dark:bg-zinc-950/60'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Click to select or drag & drop GGUF binary
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    Must be a valid <span className="text-cyan-600 dark:text-cyan-400 font-semibold">.gguf</span> model file
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-cyan-500/30 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {uploadFile.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      Size: {formatFileSize(uploadFile.size)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setUploadFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {uploadFile && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Model Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={customUploadName}
                    onChange={(e) => setCustomUploadName(e.target.value)}
                    placeholder={uploadFile.name.replace(/\.gguf$/i, '')}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Quantization (Optional)
                  </label>
                  <input
                    type="text"
                    value={customUploadQuant}
                    onChange={(e) => setCustomUploadQuant(e.target.value)}
                    placeholder="e.g. Q4_K_M, Q8_0"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* GGUF Header Inspection Info */}
            <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/5 border border-cyan-200 dark:border-cyan-500/20 text-zinc-600 dark:text-zinc-400 text-xs flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">GGUFReader Header Verification</span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Architecture, tensor count, quantization profile, and context length are automatically validated directly from binary headers.
                </p>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-mono text-zinc-600 dark:text-zinc-400">
                  <span>Streaming model to backend storage...</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isUploading || !uploadFile}
              className="w-full justify-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              {isUploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  <span>Uploading Model ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload Model to Backend Engine</span>
                </>
              )}
            </Button>
          </form>
        </div>
      )}

      {/* TAB 3: HUGGING FACE DOWNLOADER */}
      {activeTab === 'hf' && (
        <div className="glass-card p-8 max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Download GGUF Model via Hugging Face Hub
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Dispatches download requests to the FastAPI backend model management worker thread.
            </p>
          </div>

          {/* Preset GGUF Cards */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block font-medium">
              Curated Open-Weight Models (1-Click Auto-Fill)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {POPULAR_GGUF_PRESETS.map((preset) => (
                <div
                  key={preset.repoId}
                  onClick={() => applyPreset(preset)}
                  className="p-3 rounded-xl bg-white dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 hover:border-cyan-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 cursor-pointer transition-all text-left group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                      {preset.name}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{preset.sizeApprox}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">{preset.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{validationError}</span>
            </div>
          )}

          {downloadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">Model download registered with FastAPI backend BackgroundTasks!</span>
            </div>
          )}

          <form onSubmit={handleDownloadSubmit} className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div>
              <label className="block text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 uppercase mb-1.5">
                Hugging Face Model / Repository ID <span className="text-rose-500 dark:text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                placeholder="e.g. TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>Auto-resolved via Hub API. Metadata & quantization will be extracted automatically using <code className="text-cyan-600 dark:text-cyan-400 font-semibold">gguf.GGUFReader</code>.</span>
              </p>
            </div>

            {/* Live Download Progress Monitor */}
            {isDownloading && downloadProgress && (
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-cyan-300 dark:border-cyan-500/30 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {downloadProgress.status === 'extracting_metadata'
                        ? 'Extracting metadata with GGUFReader...'
                        : downloadProgress.status === 'ready'
                        ? 'Model verified & ready!'
                        : 'Streaming GGUF weights from Hugging Face...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {downloadProgress.speed && (
                      <span className="text-zinc-500 dark:text-zinc-400">{downloadProgress.speed}</span>
                    )}
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold">{downloadProgress.percent.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, downloadProgress.percent))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  <span>
                    {downloadProgress.downloaded_bytes > 0
                      ? `${formatFileSize(downloadProgress.downloaded_bytes)} of ${formatFileSize(downloadProgress.total_bytes)}`
                      : 'Connecting to Hugging Face CDN...'}
                  </span>
                  {downloadProgress.filename && (
                    <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]">
                      {downloadProgress.filename}
                    </span>
                  )}
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isDownloading || !repoId.trim()}
              className="w-full justify-center gap-2 shadow-lg shadow-cyan-500/20 mt-4"
            >
              {isDownloading ? (
                <>
                  <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  <span>
                    {downloadProgress?.status === 'extracting_metadata'
                      ? 'GGUFReader Extracting Metadata...'
                      : `Downloading Model (${downloadProgress?.percent.toFixed(0) || 0}%)...`}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Model via Hugging Face</span>
                </>
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
