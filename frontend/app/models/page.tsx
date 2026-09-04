"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Info,
  Sparkles,
  Upload,
  FileUp,
  FileText,
  X,
  Activity,
  Play,
  Square,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Send,
  Zap,
  Power,
} from 'lucide-react';
import { AIModelResponse, LlamaServerStatusResponse, ModelRuntimeStatus } from '@/lib/api/types';
import { modelsApi } from '@/lib/api/models';
import { runtimeApi } from '@/lib/api/runtime';
import { useToast } from '@/context/toast-context';

export default function ModelsPage() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'downloaded' | 'upload' | 'hf' | 'runtime'>('downloaded');
  const [models, setModels] = useState<AIModelResponse[]>([]);
  const [serverStatus, setServerStatus] = useState<LlamaServerStatusResponse | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<ModelRuntimeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Runtime Controls state
  const [selectedRuntimeModel, setSelectedRuntimeModel] = useState<string>('');
  const [runtimePort, setRuntimePort] = useState<number>(8080);
  const [runtimeCtxSize, setRuntimeCtxSize] = useState<number>(4096);
  const [runtimeGpuLayers, setRuntimeGpuLayers] = useState<number>(99);
  const [isStartingRuntime, setIsStartingRuntime] = useState(false);
  const [isStoppingRuntime, setIsStoppingRuntime] = useState(false);
  const [runtimeLogs, setRuntimeLogs] = useState<string[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [testPrompt, setTestPrompt] = useState('Explain sovereign agentic AI in two sentences.');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

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
  const [uploadModelName, setUploadModelName] = useState('');
  const [uploadQuantization, setUploadQuantization] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    modelsApi.checkLlamaStatus()
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

    // Also fetch initial model runtime status
    runtimeApi.getModelStatus()
      .then((st) => {
        if (active && st) {
          setRuntimeStatus(st);
          if (st.model_name) setSelectedRuntimeModel(st.model_name);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [toast]);

  // Periodic polling for runtime status when in runtime tab
  useEffect(() => {
    if (activeTab !== 'runtime') return;
    let active = true;

    const poll = () => {
      runtimeApi.getModelStatus()
        .then((st) => {
          if (active && st) setRuntimeStatus(st);
        })
        .catch(() => {});
    };

    poll();
    const interval = setInterval(poll, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeTab]);

  const fetchRuntimeStatus = async () => {
    try {
      const status = await runtimeApi.getModelStatus();
      setRuntimeStatus(status);
      if (status.model_name && !selectedRuntimeModel) {
        setSelectedRuntimeModel(status.model_name);
      }
    } catch {
      // Ignored
    }
  };

  const handleStartRuntime = async () => {
    const targetModel = selectedRuntimeModel || (models.length > 0 ? models[0].name : '');
    if (!targetModel) {
      toast.warning('No GGUF models available. Please upload or download a model first.', 'No Model Selected');
      return;
    }
    setIsStartingRuntime(true);
    try {
      const status = await runtimeApi.startModel({
        model: targetModel,
        port: Number(runtimePort) || 8080,
        ctx_size: Number(runtimeCtxSize) || 4096,
        n_gpu_layers: Number(runtimeGpuLayers) || 99,
        wait_ready: true,
      });
      setRuntimeStatus(status);
      toast.success(
        `llama-server online on port ${status.port} running model "${status.model_name}"`,
        'Server Ready'
      );
      handleFetchLogs();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to start llama-server.';
      toast.error(detail, 'Start Error');
    } finally {
      setIsStartingRuntime(false);
    }
  };

  const handleStopRuntime = async () => {
    setIsStoppingRuntime(true);
    try {
      const status = await runtimeApi.stopModel();
      setRuntimeStatus(status);
      toast.info('llama-server process stopped.', 'Server Stopped');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to stop llama-server.';
      toast.error(detail, 'Stop Error');
    } finally {
      setIsStoppingRuntime(false);
    }
  };

  const handleFetchLogs = async () => {
    setIsFetchingLogs(true);
    try {
      const res = await runtimeApi.getModelLogs(150);
      setRuntimeLogs(res.logs || []);
    } catch {
      // Ignored
    } finally {
      setIsFetchingLogs(false);
    }
  };

  const handleTestPrompt = async () => {
    if (!testPrompt.trim()) return;
    setIsTestingModel(true);
    setTestResponse(null);
    setTestLatency(null);
    try {
      const res = await runtimeApi.testModel({
        prompt: testPrompt,
        max_tokens: 150,
      });
      setTestResponse(res.response);
      setTestLatency(res.latency_ms);
      toast.success(`Inference finished in ${res.latency_ms}ms`, 'Inference Completed');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Inference test failed.';
      toast.error(detail, 'Inference Error');
    } finally {
      setIsTestingModel(false);
    }
  };

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

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gguf')) {
      setUploadError('Invalid File: Only .gguf model files are accepted for local upload.');
      setUploadFile(null);
      return;
    }

    setUploadError(null);
    setUploadFile(file);

    // Auto-populate friendly name from filename
    const baseName = file.name.replace(/\.gguf$/i, '');
    setUploadModelName(baseName);

    // Auto-detect quantization from filename
    const match = file.name.match(/\b(q[0-9]_[a-z0-9_]+|f16|f32|bf16)\b/i);
    if (match) {
      setUploadQuantization(match[1].toUpperCase());
    } else {
      setUploadQuantization('');
    }
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
        uploadModelName.trim() || undefined,
        uploadQuantization.trim() || undefined,
        (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      );

      setModels((prev) => [created, ...prev]);
      setUploadSuccess(true);
      toast.success(`Model "${created.name}" uploaded successfully and ready for runtime execution!`, 'Model Uploaded');
      setUploadFile(null);
      setUploadModelName('');
      setUploadQuantization('');

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
            Downloaded ({models.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Local Model
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
          <button
            type="button"
            onClick={() => {
              setActiveTab('runtime');
              fetchRuntimeStatus();
              handleFetchLogs();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'runtime'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Model Runtime
            {runtimeStatus?.running && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Llama.cpp Server Status Banner */}
      {serverStatus && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs ${
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
                {serverStatus.installed ? 'llama.cpp Server Ready' : serverStatus.message || 'llama.cpp is not installed'}
              </span>
              <span className="hidden sm:inline text-zinc-600">|</span>
              <span className="text-zinc-400 font-mono text-[11px] truncate max-w-md">
                {serverStatus.server_path || '/backend/llama.cpp/bin/Release/llama-server.exe'}
              </span>
            </div>
          </div>
          {serverStatus.installed ? (
            <button
              type="button"
              onClick={() => {
                setActiveTab('runtime');
                fetchRuntimeStatus();
                handleFetchLogs();
              }}
              className="text-[11px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-md border border-cyan-500/20 shrink-0 font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Manage Runtime</span>
              <span className="text-xs">&rarr;</span>
            </button>
          ) : (
            <span className="text-[11px] bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-md border border-amber-500/20 shrink-0 font-mono">
              Run: powershell -File backend/build_llama.ps1
            </span>
          )}
        </div>
      )}

      {/* TAB 1: DOWNLOADED MODELS */}
      {activeTab === 'downloaded' && (
        <div>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-3">
              <Cpu className="w-8 h-8 text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-zinc-300">No GGUF models registered in backend</div>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Upload a model from your device or download one from Hugging Face to enable agent reasoning.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Local GGUF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('hf')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Hugging Face Hub</span>
                </button>
              </div>
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
                          {formatFileSize(m.size_bytes)}
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
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete Model from Disk"
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

      {/* TAB 2: UPLOAD LOCAL MODEL */}
      {activeTab === 'upload' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6 max-w-2xl mx-auto">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" />
              Upload GGUF Model from Local Device
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Select any quantized model binary (`.gguf`) from your machine to upload and register directly into backend storage.
            </p>
          </div>

          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Model uploaded and registered successfully in backend!</span>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-5">
            {/* Drag & Drop Dropzone */}
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
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-950/90 text-zinc-400'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-200">
                    Click to browse or drag & drop model file
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Supported format: <span className="text-cyan-400">.gguf</span> (e.g. Llama-3-8B-Q4_K_M.gguf)
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
                    setUploadModelName('');
                    setUploadQuantization('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Model Metadata Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
                  MODEL NAME
                </label>
                <input
                  type="text"
                  value={uploadModelName}
                  onChange={(e) => setUploadModelName(e.target.value)}
                  placeholder="e.g. Llama 3 8B Instruct"
                  className="w-full px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
                  QUANTIZATION
                </label>
                <input
                  type="text"
                  value={uploadQuantization}
                  onChange={(e) => setUploadQuantization(e.target.value)}
                  placeholder="e.g. Q4_K_M, Q5_K_M, F16"
                  className="w-full px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
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

            {/* Submit Upload Button */}
            <button
              type="submit"
              disabled={isUploading || !uploadFile}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {isUploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Uploading Model ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload Model to Backend Engine</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: HUGGING FACE DOWNLOADER */}
      {activeTab === 'hf' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6 max-w-2xl mx-auto">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              Download GGUF Model via Hugging Face Hub
            </h3>
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

      {/* TAB 4: MODEL RUNTIME (LLAMA-SERVER SUBPROCESS) */}
      {activeTab === 'runtime' && (
        <div className="space-y-6">
          {/* Status Hero Card */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                    runtimeStatus?.running
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-100">
                      Local llama-server Subprocess Daemon
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
                        runtimeStatus?.ready
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : runtimeStatus?.running
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-zinc-800/60 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          runtimeStatus?.ready
                            ? 'bg-emerald-400 animate-pulse'
                            : runtimeStatus?.running
                            ? 'bg-amber-400 animate-spin'
                            : 'bg-zinc-500'
                        }`}
                      />
                      {runtimeStatus?.ready
                        ? 'ONLINE & READY'
                        : runtimeStatus?.running
                        ? 'LOADING WEIGHTS'
                        : 'OFFLINE / STOPPED'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    {runtimeStatus?.running
                      ? `Active PID: ${runtimeStatus.pid} • Model: ${runtimeStatus.model_name || 'GGUF'} • Uptime: ${runtimeStatus.uptime_seconds || 0}s`
                      : 'Server is currently stopped. Launch with any local GGUF model below.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchRuntimeStatus}
                  className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Refresh status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                {runtimeStatus?.running ? (
                  <button
                    type="button"
                    onClick={handleStopRuntime}
                    disabled={isStoppingRuntime}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>{isStoppingRuntime ? 'Stopping...' : 'Stop Server'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRuntime}
                    disabled={isStartingRuntime}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isStartingRuntime ? 'Starting...' : 'Start Server'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Connection Bar */}
            {runtimeStatus?.running && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">OpenAI Base URL:</span>
                  <code className="text-cyan-300 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                    {runtimeStatus.base_url}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(runtimeStatus.base_url);
                      setCopiedEndpoint(true);
                      setTimeout(() => setCopiedEndpoint(false), 2000);
                    }}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Copy API Base URL"
                  >
                    {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                  <span>Ctx: <b className="text-zinc-200">{runtimeStatus.ctx_size}</b></span>
                  <span>GPU Offload: <b className="text-zinc-200">{runtimeStatus.n_gpu_layers} layers</b></span>
                  <span>Threads: <b className="text-zinc-200">{runtimeStatus.threads || 'Auto'}</b></span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Control & Configuration Card */}
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Power className="w-4 h-4 text-cyan-400" />
                Runtime Model & Runner Configuration
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-400 font-mono mb-1">
                    SELECT GGUF MODEL
                  </label>
                  {models.length === 0 ? (
                    <div className="p-3 rounded-xl bg-zinc-950 border border-dashed border-zinc-800 text-zinc-500 text-xs">
                      No models found in backend. Upload or download a GGUF model first.
                    </div>
                  ) : (
                    <select
                      value={selectedRuntimeModel}
                      onChange={(e) => setSelectedRuntimeModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">-- Choose a local model --</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({m.quantization || 'GGUF'} • {formatFileSize(m.size_bytes)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 font-mono mb-1">
                      PORT
                    </label>
                    <input
                      type="number"
                      value={runtimePort}
                      onChange={(e) => setRuntimePort(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-mono mb-1">
                      CONTEXT (TOKENS)
                    </label>
                    <select
                      value={runtimeCtxSize}
                      onChange={(e) => setRuntimeCtxSize(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
                    >
                      <option value={2048}>2048</option>
                      <option value={4096}>4096</option>
                      <option value={8192}>8192</option>
                      <option value={16384}>16384</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-mono mb-1">
                      GPU LAYERS
                    </label>
                    <input
                      type="number"
                      value={runtimeGpuLayers}
                      onChange={(e) => setRuntimeGpuLayers(Number(e.target.value))}
                      placeholder="99 = Max"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartRuntime}
                  disabled={isStartingRuntime || models.length === 0}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {isStartingRuntime ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Booting llama-server...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>{runtimeStatus?.running ? 'Switch & Reload Model' : 'Launch llama-server'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inference Diagnostic / Quick Test Card */}
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2 mb-3">
                  <Send className="w-4 h-4 text-cyan-400" />
                  Live Inference Test (OpenAI-compatible)
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-mono text-zinc-400 mb-1">
                      TEST PROMPT
                    </label>
                    <textarea
                      rows={2}
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      placeholder="Prompt the active model directly..."
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTestPrompt}
                    disabled={isTestingModel || !runtimeStatus?.ready}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isTestingModel ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Execute Prompt</span>
                      </>
                    )}
                  </button>

                  {testResponse && (
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1 animate-in fade-in">
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>MODEL OUTPUT</span>
                        {testLatency && <span className="text-cyan-400">{testLatency} ms</span>}
                      </div>
                      <p className="text-zinc-200 leading-relaxed font-sans">{testResponse}</p>
                    </div>
                  )}
                </div>
              </div>

              {!runtimeStatus?.ready && (
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-500">
                  Model must be started and reported <b className="text-emerald-400">READY</b> before running live diagnostic inference.
                </div>
              )}
            </div>
          </div>

          {/* Real-Time Terminal Console Logs Card */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                llama-server Process Output & Hardware Telemetry
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-zinc-500">
                  {runtimeLogs.length} lines captured
                </span>
                <button
                  type="button"
                  onClick={handleFetchLogs}
                  disabled={isFetchingLogs}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-800 cursor-pointer"
                  title="Refresh console logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingLogs ? 'animate-spin' : ''}`} />
                  <span>Fetch Logs</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black border border-zinc-800/80 font-mono text-[11px] text-zinc-300 h-64 overflow-y-auto space-y-1 select-text">
              {runtimeLogs.length === 0 ? (
                <div className="text-zinc-600 italic">No output logged yet. Start the model server to stream console stdout/stderr.</div>
              ) : (
                runtimeLogs.map((line, idx) => (
                  <div key={idx} className="leading-tight hover:bg-zinc-900/50">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

