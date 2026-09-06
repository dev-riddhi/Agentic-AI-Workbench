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
  chunk_count?: number;
  file_type?: string;
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
  context_window?: number;
  status: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LlamaServerStatusResponse {
  installed: boolean;
  message: string;
  server_path?: string | null;
  models: AIModelResponse[];
}

export interface ModelRuntimeStatus {
  running: boolean;
  ready: boolean;
  pid?: number | null;
  model_path?: string | null;
  model_name?: string | null;
  host: string;
  port: number;
  ctx_size: number;
  n_gpu_layers: number;
  threads?: number | null;
  base_url: string;
  health_url: string;
  uptime_seconds?: number | null;
}

export interface ActiveAgentRuntimeItem {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_model?: string | null;
  status: string;
  thread_name?: string | null;
  started_at: string;
  last_heartbeat: string;
}

export interface RuntimeOverviewResponse {
  llama_installed: boolean;
  llama_server_path?: string | null;
  model_runtime: ModelRuntimeStatus;
  active_agents_count: number;
  active_agents: ActiveAgentRuntimeItem[];
}

export interface ModelTestResponse {
  success: boolean;
  response: string;
  latency_ms: number;
  model?: string | null;
  usage?: Record<string, unknown>;
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

export type AgentTrigger = 'manual' | 'schedule' | 'onetime';

export interface Agent {
  id: string;
  owner_id: string;
  name: string;
  description?: string | null;
  instructions: string;
  model_id: string;
  model?: string | null;
  ai_model?: AIModelResponse | null;
  trigger: AgentTrigger;
  schedule?: string | null;
  max_execution_time: number;
  max_tool_calls: number;
  concurrency: number;
  retries: number;
  is_running: boolean;
  created_at: string;
  updated_at: string;
  tools: ToolResponse[];
  documents: DocumentResponse[];
}

export interface AgentCreatePayload {
  name: string;
  description?: string;
  instructions: string;
  model_id: string;
  trigger?: AgentTrigger;
  schedule?: string | null;
  max_execution_time?: number;
  max_tool_calls?: number;
  concurrency?: number;
  retries?: number;
  tools?: string[];
  document_ids?: string[];
}

export interface AgentUpdatePayload {
  name?: string;
  description?: string;
  instructions?: string;
  model_id?: string;
  trigger?: AgentTrigger;
  schedule?: string | null;
  max_execution_time?: number;
  max_tool_calls?: number;
  concurrency?: number;
  retries?: number;
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

export interface SettingsData {
  company_name: string;
  max_concurrent_agent_limit: number;
  api_url: string;
  environment: string;
  default_timeout_seconds: number;
  maintenance_mode: boolean;
  extra_values?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SettingsResponse {
  id: string;
  key: string;
  data: SettingsData;
  created_at: string;
  updated_at: string;
}

export interface SettingsUpdatePayload {
  company_name?: string;
  max_concurrent_agent_limit?: number;
  api_url?: string;
  environment?: string;
  default_timeout_seconds?: number;
  maintenance_mode?: boolean;
  extra_values?: Record<string, unknown>;
  [key: string]: unknown;
}
