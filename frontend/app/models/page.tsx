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

  // HuggingFace Form state
  const [repoId, setRepoId] = useState('');
  const [filename, setFilename] = useState('');
  const [modelName, setModelName] = useState('');
  const [quantization, setQuantization] = useState('');
  const [background, setBackground] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Local Device Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    modelsApi
      .checkLlamaStatus()
      .then((data) => {
        if (active) {
          setServerStatus(data);
          setModels(data.models || []);
        }
      })
      .catch(() => {
        return modelsApi.getModels().then((data) => {
          if (active) setModels(data || []);
        });
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
          name: modelName.trim() || filename.trim(),
          quantization: quantization.trim() || undefined,
        },
        background
      );

      setModels((prev) => [result, ...prev]);
      setDownloadSuccess(true);
      toast.success(`Download request accepted by backend for ${filename}.`, 'Download Dispatched');
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

  const applyPreset = (preset: (typeof POPULAR_GGUF_PRESETS)[0]) => {
    setRepoId(preset.repoId);
    setFilename(preset.filename);
    setModelName(preset.name);
    setQuantization(preset.quantization);
    toast.info(`Filled parameters for ${preset.name}`, 'Preset Applied');
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gguf')) {
      setUploadError('Invalid File: Only .gguf model files are accepted for local upload.');
      setUploadFile(null);
      return;
    }

    setUploadError(null);
    setUploadFile(file);
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
      const created = await modelsApi.uploadModel(uploadFile, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      setModels((prev) => [created, ...prev]);
      setUploadSuccess(true);
      toast.success(`Model "${created.name}" uploaded successfully and ready for runtime execution!`, 'Model Uploaded');
      setUploadFile(null);

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

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Tab Controls */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Local Model Hub (GGUF Weights)</h1>
              <Badge variant="cyan">Air-Gapped LLM</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Zero-egress quantized language model repository powering local llama-server reasoning.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-medium self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('downloaded')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'downloaded'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Catalog ({models.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Local GGUF</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hf')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'hf'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Hugging Face Hub</span>
            </button>
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 block">REGISTERED MODELS</span>
            <span className="text-sm font-bold text-zinc-100">{models.length} Binaries</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 block">DISK FOOTPRINT</span>
            <span className="text-sm font-bold text-cyan-400">{formatFileSize(totalModelBytes)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 block">SERVER ENGINE</span>
            <span className="text-sm font-bold text-emerald-400">
              {serverStatus?.installed ? 'llama.cpp Ready' : 'Standby'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 block">LOCAL RUNTIME</span>
            <span className="text-sm font-bold text-zinc-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              127.0.0.1:8080
            </span>
          </div>
        </div>
      </div>

      {/* Llama.cpp Status Notice */}
      {serverStatus && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border text-xs ${
            serverStatus.installed
              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
              : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {serverStatus.installed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {serverStatus.installed ? 'llama.cpp Server Binary Verified' : serverStatus.message || 'llama.cpp is not installed'}
              </span>
              <span className="hidden sm:inline text-zinc-600">|</span>
              <span className="text-zinc-400 font-mono text-[11px] truncate max-w-md">
                {serverStatus.server_path || '/backend/llama.cpp/bin/Release/llama-server.exe'}
              </span>
            </div>
          </div>
          <Link href="/runtime">
            <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2.5 text-cyan-300">
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
            <div className="p-12 text-center rounded-2xl glass-card border border-dashed border-zinc-800 space-y-3">
              <Cpu className="w-10 h-10 text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-zinc-200">No GGUF models registered in local storage</div>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl glass-card flex flex-col justify-between space-y-4 hover:border-cyan-500/40 transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-100 group-hover:text-cyan-300 transition-colors">
                          {m.name}
                        </h3>
                        <p className="text-xs text-zinc-500 font-mono truncate max-w-sm mt-0.5">
                          {m.repo_id || 'Local Binary Ingestion'}
                        </p>
                      </div>
                      <Badge variant="cyan">{m.quantization || 'Q4_K_M'}</Badge>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs font-mono space-y-1.5 text-zinc-400">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">FILENAME:</span>
                        <span className="text-zinc-200 truncate max-w-[220px]">{m.filename}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">SIZE ON DISK:</span>
                        <span className="text-zinc-200">{formatFileSize(m.size_bytes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">STATUS:</span>
                        <span className="text-emerald-400 uppercase font-semibold">
                          ● {m.status || 'Ready'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">CONTEXT:</span>
                        <span className="text-zinc-300">{m.context_window || 4096} tokens</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      In-Memory Capable
                    </span>

                    <div className="flex items-center gap-2">
                      <Link href={`/chat?modelId=${m.id}`}>
                        <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs gap-1">
                          <MessageSquare className="w-3 h-3 text-cyan-400" />
                          <span>Chat</span>
                        </Button>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDelete(m.id, m.name)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete Model from Disk"
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
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" />
              Upload GGUF Model from Local Device
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Select any quantized model binary (`.gguf`) from your machine to upload and register directly into backend storage.
            </p>
          </div>

          {uploadError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center gap-2">
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
                    ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                    : 'border-zinc-700/80 hover:border-cyan-500/50 bg-zinc-950/60'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-100">
                    Click to select or drag & drop GGUF binary
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    Must be a valid <span className="text-cyan-400">.gguf</span> model file
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-950 border border-cyan-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100 truncate">
                      {uploadFile.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">
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
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* GGUF Header Inspection Info */}
            <div className="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-zinc-400 text-xs flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-zinc-200">GGUFReader Header Verification</span>
                <p className="text-[11px] text-zinc-400">
                  Architecture, tensor count, quantization profile, and context length are automatically validated directly from binary headers.
                </p>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>Streaming model to backend storage...</span>
                  <span className="text-cyan-400 font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
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
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              Download GGUF Model via Hugging Face Hub
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Dispatches download requests to the FastAPI backend model management worker thread.
            </p>
          </div>

          {/* Preset GGUF Cards */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
              Curated Open-Weight Models (1-Click Auto-Fill)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {POPULAR_GGUF_PRESETS.map((preset) => (
                <div
                  key={preset.repoId}
                  onClick={() => applyPreset(preset)}
                  className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-cyan-500/40 hover:bg-zinc-900/60 cursor-pointer transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200 group-hover:text-cyan-300 transition-colors">
                      {preset.name}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">{preset.sizeApprox}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">{preset.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{validationError}</span>
            </div>
          )}

          {downloadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">Model download registered with FastAPI backend BackgroundTasks!</span>
            </div>
          )}

          <form onSubmit={handleDownloadSubmit} className="space-y-4 pt-2 border-t border-zinc-800">
            <div>
              <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase mb-1.5">
                Hugging Face Repo ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                placeholder="e.g. TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase mb-1.5">
                GGUF Filename <span className="text-rose-400">* (must end in .gguf)</span>
              </label>
              <input
                type="text"
                required
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g. tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase mb-1.5">
                  Display Designation
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. TinyLlama 1.1B"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase mb-1.5">
                  Quantization Identifier
                </label>
                <input
                  type="text"
                  value={quantization}
                  onChange={(e) => setQuantization(e.target.value)}
                  placeholder="e.g. Q4_K_M"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
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
              <span>Download asynchronously via backend BackgroundTasks worker</span>
            </label>

            <Button
              variant="primary"
              size="lg"
              disabled={isDownloading}
              className="w-full justify-center gap-2 shadow-lg shadow-cyan-500/20 mt-4"
            >
              {isDownloading ? (
                <>
                  <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  <span>Connecting to Backend...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Dispatch Download via Backend</span>
                </>
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
