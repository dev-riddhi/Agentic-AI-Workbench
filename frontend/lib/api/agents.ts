import { apiClient } from './client';
import {
  Agent,
  AgentCreatePayload,
  AgentUpdatePayload,
  AgentRunResponse,
  AgentStopResponse,
  AvailableToolResponse,
  DocumentResponse,
  AgentActionRecord,
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

  getTools: async (): Promise<AvailableToolResponse[]> => {
    const response = await apiClient.get<AvailableToolResponse[]>('/agents/tools');
    return response.data;
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

  runAgentStream: async ({
    id,
    prompt,
    conversation_id,
    onEvent,
    onError,
    onDone,
    signal,
  }: {
    id: string;
    prompt: string;
    conversation_id?: string | null;
    onEvent: (event: import('./types').AgentStreamEvent) => void;
    onError?: (error: Error) => void;
    onDone?: () => void;
    signal?: AbortSignal;
  }): Promise<void> => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    try {
      const response = await fetch(`${API_BASE_URL}/agents/${id}/run/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt, conversation_id }),
        signal,
      });

      if (!response.ok) {
        let errMessage = `Request failed with status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.detail) {
            errMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported on this browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Handle SSE keep-alive heartbeat comments
          if (trimmed.startsWith(':') || trimmed.includes('keep-alive')) {
            onEvent({ type: 'ping', timestamp: new Date().toISOString() });
            continue;
          }

          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            onDone?.();
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr) as import('./types').AgentStreamEvent;
            if (parsed.type === 'error' && parsed.error) {
              onError?.(new Error(parsed.error));
            }
            onEvent(parsed);
          } catch (e: unknown) {
            const parseErr = e instanceof Error ? e : new Error(String(e));
            if (parseErr.message !== 'Unexpected end of JSON input') {
              onError?.(parseErr);
            }
          }
        }
      }

      onDone?.();
    } catch (err: unknown) {
      if (signal?.aborted) {
        return;
      }
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  },

  stopAgent: async (id: string, execution_id?: string): Promise<AgentStopResponse> => {
    const response = await apiClient.post<AgentStopResponse>(`/agents/${id}/stop`, { execution_id });
    return response.data;
  },

  getRunningAgents: async (): Promise<Agent[]> => {
    const response = await apiClient.get<Agent[]>('/agents/running');
    return response.data;
  },

  getAgentDocuments: async (id: string): Promise<DocumentResponse[]> => {
    const response = await apiClient.get<DocumentResponse[]>(`/agents/${id}/documents`);
    return response.data;
  },

  getAgentThreadStatus: async (id: string): Promise<{
    agent_id: string;
    is_running: boolean;
    is_alive: boolean;
    status: string;
    thread_name?: string | null;
    started_at?: string | null;
    task_prompt?: string | null;
  }> => {
    const response = await apiClient.get(`/agents/${id}/thread-status`);
    return response.data;
  },

  getAgentActions: async (id: string, limit: number = 50): Promise<AgentActionRecord[]> => {
    const response = await apiClient.get<AgentActionRecord[]>(`/agents/${id}/actions`, {
      params: { limit },
    });
    return response.data;
  },

  getLatestActions: async (limit: number = 50): Promise<AgentActionRecord[]> => {
    const response = await apiClient.get<AgentActionRecord[]>('/agents/actions/latest', {
      params: { limit },
    });
    return response.data;
  },
};

