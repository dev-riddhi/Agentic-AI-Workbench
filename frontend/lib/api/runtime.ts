import { apiClient } from './client';
import {
  ActiveAgentRuntimeItem,
  AgentRuntimeStatus,
  ModelRuntimeStatus,
  ModelTestResponse,
  RuntimeOverviewResponse,
  RuntimeStatusResponse,
} from './types';

export interface StartModelPayload {
  model: string;
  port?: number;
  host?: string;
  ctx_size?: number;
  n_gpu_layers?: number;
  threads?: number;
  wait_ready?: boolean;
  timeout?: number;
}

export const runtimeApi = {
  getOverview: async (): Promise<RuntimeOverviewResponse> => {
    const response = await apiClient.get<RuntimeOverviewResponse>('/runtime/overview');
    return response.data;
  },

  // Model Runtime endpoints
  getModelStatus: async (): Promise<ModelRuntimeStatus> => {
    const response = await apiClient.get<ModelRuntimeStatus>('/runtime/models/status');
    return response.data;
  },

  startModel: async (payload: StartModelPayload): Promise<ModelRuntimeStatus> => {
    const response = await apiClient.post<ModelRuntimeStatus>('/runtime/models/start', payload);
    return response.data;
  },

  stopModel: async (): Promise<ModelRuntimeStatus> => {
    const response = await apiClient.post<ModelRuntimeStatus>('/runtime/models/stop');
    return response.data;
  },

  getModelLogs: async (lines = 100): Promise<{ logs: string[] }> => {
    const response = await apiClient.get<{ logs: string[] }>('/runtime/models/logs', {
      params: { lines },
    });
    return response.data;
  },

  testModel: async (payload: {
    prompt: string;
    max_tokens?: number;
    temperature?: number;
  }): Promise<ModelTestResponse> => {
    const response = await apiClient.post<ModelTestResponse>('/runtime/models/test', payload);
    return response.data;
  },

  // Agent Runtime endpoints
  getAgentRuntimeStatus: async (): Promise<AgentRuntimeStatus> => {
    const response = await apiClient.get<AgentRuntimeStatus>('/runtime/agents/status');
    return response.data;
  },

  startAgentScheduler: async (): Promise<AgentRuntimeStatus> => {
    const response = await apiClient.post<AgentRuntimeStatus>('/runtime/agents/scheduler/start');
    return response.data;
  },

  stopAgentScheduler: async (): Promise<AgentRuntimeStatus> => {
    const response = await apiClient.post<AgentRuntimeStatus>('/runtime/agents/scheduler/stop');
    return response.data;
  },

  getRuntimeStatus: async (): Promise<RuntimeStatusResponse> => {
    const response = await apiClient.get<RuntimeStatusResponse>('/runtime/status');
    return response.data;
  },

  getActiveAgents: async (): Promise<ActiveAgentRuntimeItem[]> => {
    const response = await apiClient.get<ActiveAgentRuntimeItem[]>('/runtime/agents');
    return response.data;
  },

  startAgent: async (
    agentId: string,
    prompt?: string
  ): Promise<{ success: boolean; message: string; agent?: ActiveAgentRuntimeItem }> => {
    const response = await apiClient.post(`/runtime/agents/${agentId}/start`, { prompt });
    return response.data;
  },

  stopAgent: async (agentId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`/runtime/agents/${agentId}/stop`);
    return response.data;
  },
};
