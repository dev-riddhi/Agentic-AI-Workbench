export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface ToolResponse {
  id: string;
  name: string;
  description?: string | null;
  handler: string;
}

export interface DocumentResponse {
  id: string;
  name: string;
  filename: string;
  file_path: string;
  mime_type?: string | null;
  size_bytes: number;
  status: string;
  created_at: string;
}

export interface AIModelResponse {
  id: string;
  name: string;
  repo_id: string;
  filename: string;
  file_path: string;
  format: string;
  size_bytes: number;
  quantization?: string | null;
  status: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunningAgentResponse {
  id: string;
  agent_id: string;
  status: string;
  auto_restart: boolean;
  started_at: string;
  last_heartbeat: string;
  configuration?: string | null;
}

export interface Agent {
  id: string;
  owner_id: string;
  name: string;
  description?: string | null;
  instructions: string;
  model_id: string;
  model?: string | null;
  ai_model?: AIModelResponse | null;
  created_at: string;
  updated_at: string;
  tools: ToolResponse[];
  documents: DocumentResponse[];
  running_state?: RunningAgentResponse | null;
}

export interface AgentCreatePayload {
  name: string;
  description?: string;
  instructions: string;
  model_id: string;
  tools?: string[];
  document_ids?: string[];
}

export interface AgentUpdatePayload {
  name?: string;
  description?: string;
  instructions?: string;
  model_id?: string;
  tools?: string[];
  document_ids?: string[];
}

export interface AgentRunResponse {
  execution_id: string;
  agent_id: string;
  status: string;
  response: string;
  tool_calls: Array<{
    name?: string;
    arguments?: Record<string, unknown>;
    result?: unknown;
    status?: string;
  }>;
  completed_at: string;
}
