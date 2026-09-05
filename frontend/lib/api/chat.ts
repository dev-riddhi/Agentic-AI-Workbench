import { apiClient } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  latency_ms?: number;
  interrupted?: boolean;
}

export interface ConversationResponse {
  id: string;
  user_id: string;
  model_id: string | null;
  model_name?: string | null;
  agent_id?: string | null;
  title: string | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  model_id: string | null;
  model_name?: string | null;
  title: string | null;
  message_count: number;
  last_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatCreatePayload {
  model_id: string;
  title?: string;
  initial_message?: string;
  system_prompt?: string;
}

export interface SendMessagePayload {
  message: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface StreamMessageOptions {
  conversationId: string;
  payload: SendMessagePayload;
  onToken: (token: string) => void;
  onComplete?: (conversation: ConversationResponse) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export const chatApi = {
  listConversations: async (modelId?: string): Promise<ConversationSummary[]> => {
    const response = await apiClient.get<ConversationSummary[]>('/chat/', {
      params: modelId ? { model_id: modelId } : undefined,
    });
    return response.data;
  },

  createConversation: async (payload: ChatCreatePayload): Promise<ConversationResponse> => {
    const response = await apiClient.post<ConversationResponse>('/chat/', payload);
    return response.data;
  },

  getConversation: async (id: string): Promise<ConversationResponse> => {
    const response = await apiClient.get<ConversationResponse>(`/chat/${id}`);
    return response.data;
  },

  deleteConversation: async (id: string): Promise<{ success: boolean; id: string }> => {
    const response = await apiClient.delete<{ success: boolean; id: string }>(`/chat/${id}`);
    return response.data;
  },

  sendMessage: async (conversationId: string, payload: SendMessagePayload): Promise<ConversationResponse> => {
    const response = await apiClient.post<ConversationResponse>(`/chat/${conversationId}/messages`, payload);
    return response.data;
  },

  streamMessage: async ({
    conversationId,
    payload,
    onToken,
    onComplete,
    onError,
    signal,
  }: StreamMessageOptions): Promise<void> => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    try {
      const response = await fetch(`${API_BASE_URL}/chat/${conversationId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
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
          // ignore parsing error
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
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.token) {
              onToken(parsed.token);
            }
            if (parsed.done && parsed.conversation) {
              onComplete?.(parsed.conversation);
            }
          } catch (e: unknown) {
            const parseErr = e instanceof Error ? e : new Error(String(e));
            if (parseErr.message !== 'Unexpected end of JSON input') {
              onError?.(parseErr);
              return;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (signal?.aborted) {
        return;
      }
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  },
};
