import { apiClient } from './client';
import { AIModelResponse, LlamaServerStatusResponse, ModelRuntimeStatus } from './types';

export interface ModelDownloadPayload {
  repo_id: string;
  filename?: string;
  name?: string;
  quantization?: string;
}

export const modelsApi = {
  checkLlamaStatus: async (skip = 0, limit = 100): Promise<LlamaServerStatusResponse> => {
    const response = await apiClient.get<LlamaServerStatusResponse>('/models/status', {
      params: { skip, limit },
    });
    return response.data;
  },

  getModels: async (skip = 0, limit = 100): Promise<AIModelResponse[]> => {
    const response = await apiClient.get<AIModelResponse[]>('/models/', {
      params: { skip, limit },
    });
    return response.data;
  },

  getModel: async (id: string): Promise<AIModelResponse> => {
    const response = await apiClient.get<AIModelResponse>(`/models/${id}`);
    return response.data;
  },

  downloadModel: async (
    payload: ModelDownloadPayload,
    background = true
  ): Promise<AIModelResponse> => {
    const response = await apiClient.post<AIModelResponse>('/models/download', payload, {
      params: { background },
    });
    return response.data;
  },

  getDownloadProgress: async (id: string): Promise<{
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
  }> => {
    const response = await apiClient.get(`/models/${id}/progress`);
    return response.data;
  },

  uploadModel: async (
    file: File,
    nameOrProgress?: string | ((progressEvent: { loaded: number; total?: number }) => void),
    quantization?: string,
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void
  ): Promise<AIModelResponse> => {
    let name: string | undefined;
    let progressCallback = onUploadProgress;

    if (typeof nameOrProgress === 'function') {
      progressCallback = nameOrProgress;
    } else {
      name = nameOrProgress;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    if (quantization) formData.append('quantization', quantization);

    const response = await apiClient.post<AIModelResponse>('/models/upload', formData, {
      onUploadProgress: progressCallback,
      timeout: 0,
    });
    return response.data;
  },

  deleteModel: async (id: string): Promise<void> => {
    await apiClient.delete(`/models/${id}`);
  },

  startRuntime: async (payload: {
    model: string;
    port?: number;
    host?: string;
    ctx_size?: number;
    n_gpu_layers?: number;
    threads?: number;
    n_cpu_moe?: number;
    mmap?: boolean;
    mlock?: boolean;
    cache_type_k?: string;
    cache_type_v?: string;
    wait_ready?: boolean;
    timeout?: number;
  }): Promise<ModelRuntimeStatus> => {
    const response = await apiClient.post<ModelRuntimeStatus>('/models/runtime/start', payload);
    return response.data;
  },

  stopRuntime: async (): Promise<ModelRuntimeStatus> => {
    const response = await apiClient.post<ModelRuntimeStatus>('/models/runtime/stop');
    return response.data;
  },

  getRuntimeStatus: async (): Promise<ModelRuntimeStatus> => {
    const response = await apiClient.get<ModelRuntimeStatus>('/models/runtime/status');
    return response.data;
  },

  getRuntimeLogs: async (lines = 100): Promise<{ logs: string[] }> => {
    const response = await apiClient.get<{ logs: string[] }>('/models/runtime/logs', {
      params: { lines },
    });
    return response.data;
  },
};
