import { apiClient } from './client';
import {
  Agent,
  AgentCreatePayload,
  AgentUpdatePayload,
  AgentRunResponse,
  DocumentResponse,
} from './types';

export const agentsApi = {
  getAgents: async (skip = 0, limit = 100): Promise<Agent[]> => {
    const response = await apiClient.get<Agent[]>('/agents/', {
      params: { skip, limit },
    });
    return response.data;
  },

  getAgent: async (id: string): Promise<Agent> => {
    const response = await apiClient.get<Agent>(`/agents/${id}`);
    return response.data;
  },

  createAgent: async (payload: AgentCreatePayload): Promise<Agent> => {
    const response = await apiClient.post<Agent>('/agents/', payload);
    return response.data;
  },

  updateAgent: async (id: string, payload: AgentUpdatePayload): Promise<Agent> => {
    const response = await apiClient.patch<Agent>(`/agents/${id}`, payload);
    return response.data;
  },

  deleteAgent: async (id: string): Promise<void> => {
    await apiClient.delete(`/agents/${id}`);
  },

  runAgent: async (
    id: string,
    prompt: string,
    conversation_id?: string | null,
    auto_restart = true
  ): Promise<AgentRunResponse> => {
    const response = await apiClient.post<AgentRunResponse>(`/agents/${id}/run`, {
      prompt,
      conversation_id,
      auto_restart,
    });
    return response.data;
  },

  stopAgent: async (id: string, execution_id?: string): Promise<void> => {
    await apiClient.post(`/agents/${id}/stop`, { execution_id });
  },

  getRunningAgents: async (): Promise<Agent[]> => {
    const response = await apiClient.get<Agent[]>('/agents/running');
    return response.data;
  },

  getAgentDocuments: async (id: string): Promise<DocumentResponse[]> => {
    const response = await apiClient.get<DocumentResponse[]>(`/agents/${id}/documents`);
    return response.data;
  },
};
