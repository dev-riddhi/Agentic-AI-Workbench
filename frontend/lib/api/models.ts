import { apiClient } from './client';
import { AIModelResponse } from './types';

export interface ModelDownloadPayload {
  repo_id: string;
  filename: string;
  name?: string;
  quantization?: string;
}

export const modelsApi = {
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

  deleteModel: async (id: string): Promise<void> => {
    await apiClient.delete(`/models/${id}`);
  },
};
