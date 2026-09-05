# Sovereign On-Premise Agentic AI Workbench — Frontend

## 1. Main Goal

The frontend is the visual control console and orchestration interface for the Sovereign On-Premise Agentic AI Workbench.

Its primary goal is to provide enterprise operators, engineers, and administrators with an intuitive, responsive, and secure interface to:

> **Design, configure, schedule, supervise, and interact with autonomous AI agents powered by locally running open-weight GGUF models, while maintaining strict air-gapped security and zero external telemetry.**

---

## 2. Frontend Architecture

The frontend is built with **Next.js 15+ (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS**, using a dark, modern industrial control aesthetic (Zinc 950 palette with Cyan, Emerald, and Indigo accents).

```text
                                   ROOT LAYOUT (`app/layout.tsx`)
                                                  │
                   ┌──────────────────────────────┼──────────────────────────────┐
                   ▼                              ▼                              ▼
            <Providers>                     <AuthProvider>                 <ToastProvider>
         (Theme & Query Cache)         (JWT & Refresh Rotation)        (Toasts & Modal Dialogs)
                                                  │
                                                  ▼
                                      <NavigationShell>
                                                  │
                  ┌───────────────────────────────┴───────────────────────────────┐
                  ▼                                                               ▼
        [If Unauthenticated]                                            [If Authenticated]
           Login Screen                                              ┌────────────────────────┐
       (`app/auth/login/page.tsx`)                                   │ Sidebar + Header Shell │
                                                                     └───────────┬────────────┘
                                                                                 │
        ┌───────────────────┬───────────────────┬───────────────────┬────────────┴───────┬───────────────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼                    ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Agents     │   │ Agent Builder │   │ Agent Console │   │   Knowledge   │    │   Model Hub   │   │  Model Chat   │   │    Runtime    │
│   Workspace   │   │  & Scheduler  │   │ (Run / State) │   │     Vault     │    │ (GGUF Models) │   │ (Direct LLM)  │   │    Status     │
│ (`/agents`)   │   │(`/agents/new`)│   │(`/agents/[id]`)   │ (`/documents`)│    │ (`/models`)   │   │  (`/chat`)    │   │ (`/runtime`)  │
└───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘    └───────────────┘   └───────────────┘   └───────────────┘
                                                                                                                           │
                                                                                                                           ▼
                                                                                                                 ┌───────────────────┐
                                                                                                                 │    Settings &     │
                                                                                                                 │    Governance     │
                                                                                                                 │   (`/settings`)   │
                                                                                                                 └───────────────────┘
```

### 2.1 Key Design Elements
* **Air-Gapped Status Indicator**: Persistent badge in the sidebar verifying local loopback connection (`127.0.0.1`) and strict 0.0 KB egress.
* **Dual Runtime Visibility**: Real-time status cards reflecting both background agent worker threads and the local `llama-server.exe` instance.
* **Deterministic Configuration**: Full exposure of agent triggers (manual, schedule, onetime), execution parameters (max execution time, max tool calls, concurrency, retries), and tool attachments.
* **Token Rotation Interceptor**: Client-side Axios interceptor transparently refreshes expired JWT access tokens using single-use rotating refresh tokens without interrupting user workflows.

---

# 3. Core Workspaces & Application Screens

### 3.1 Agents Workspace (`/app/agents/page.tsx`)

The central dashboard displaying all configured AI agents in the organization.

* **Agent Cards**:
  * Name, description, and assigned model badge.
  * **Trigger Badge**: Indicates execution schedule (`manual`, `schedule: every 1 day at 09:00`, or `onetime: YYYY-MM-DD`).
  * **Runtime Status Pulse**: Green pulse indicator when an agent is actively executing in a worker thread (`Active`), or neutral badge when `Idle`.
  * **Assigned Tools**: Visual chips for attached tools (`Database`, `Documents`, `Email`).
  * **Attached Knowledge**: Indicator of linked vector documents.
* **Quick Actions**:
  * **Open**: Navigates to the Agent Console (`/agents/[id]`) for interactive execution and reasoning logs.
  * **Configure**: Edit system instructions, model, tools, or schedule.
  * **Delete**: Removes the agent configuration.
  * **[+ Create Agent]**: Opens the multi-step Agent Builder wizard.

---

### 3.2 Agent Builder & Scheduler (`/app/agents/new/page.tsx`)

A multi-section configuration wizard to create production-grade autonomous agents:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Create New Agent                                                       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. GENERAL INFORMATION                                                 │
│    Agent Name: [ Daily Sales Analyst                             ]     │
│    System Instructions:                                                │
│    [ Analyze the latest sales data and generate a summary report...  ] │
├────────────────────────────────────────────────────────────────────────┤
│ 2. MODEL SELECTION                                                     │
│    Select GGUF Model: [ TinyLlama 1.1B Chat (Q4_K_M)             ▼ ]   │
├────────────────────────────────────────────────────────────────────────┤
│ 3. TRIGGER & SCHEDULING                                                │
│    ( ) Manual        (•) Schedule         ( ) One-Time                 │
│    Repeat Every: [ 1 ] [ Day(s) ▼ ]  At: [ 09:00 ]                     │
├────────────────────────────────────────────────────────────────────────┤
│ 4. TOOL CAPABILITIES                                                   │
│    [✓] Database (Query relational tables & SQL analytics)              │
│    [✓] Documents (Vector retrieval across uploaded knowledge)          │
│    [ ] Email (Draft and dispatch operational summaries)                │
├────────────────────────────────────────────────────────────────────────┤
│ 5. KNOWLEDGE VAULT ATTACHMENT                                          │
│    [✓] Q3_Sales_Report.pdf (1.0 MB, indexed)                           │
│    [ ] Maintenance_Manual.pdf (4.2 MB, indexed)                        │
├────────────────────────────────────────────────────────────────────────┤
│ 6. ADVANCED EXECUTION CONTROLS                                         │
│    Max Execution Time: [ 10 ] mins    Max Tool Calls: [ 50 ]           │
│    Concurrency Limit:  [ 1  ] worker  Retry Attempts: [ 3  ]           │
├────────────────────────────────────────────────────────────────────────┤
│                                         [Cancel]  [Create Agent]       │
└────────────────────────────────────────────────────────────────────────┘
```

#### Supported Trigger Engines
1. **Manual**: Agent runs only when explicitly triggered by an operator via the UI or API.
2. **Schedule**: Automated periodic execution based on interval count, interval unit (`minute`, `hour`, `day`, `week`), and time of day (`HH:MM`).
3. **One-Time**: Scheduled for single execution at a future date and time picker.

---

### 3.3 Agent Console / Workspace (`/app/agents/[id]/page.tsx`)

Interactive execution and reasoning environment:

* **Header Controls**: Shows active model, trigger type, and execution controls (**Run Task**, **Stop Execution**).
* **Reasoning Console**:
  * Displays user prompts and agent responses formatted with markdown syntax highlighting.
  * **Tool Execution Tree**: Step-by-step breakdown of tools invoked during reasoning (e.g. `Database -> Query executed in 14ms`, `Documents -> 3 excerpts retrieved`).
* **Configuration Tab**: Inline editor to update agent system prompt, trigger schedule, tools, or advanced limits without leaving the console.

---

### 3.4 Knowledge Vault (`/app/documents/page.tsx`)

Manages company documents for local Retrieval-Augmented Generation (RAG):

* **Drag-and-Drop Ingestion**: Supports `.pdf`, `.docx`, `.txt` file uploads.
* **Vector Indexing Tracker**: Displays document processing status (`pending`, `indexed`, `failed`).
* **Document Directory**: Table with document filename, MIME type, file size in bytes, upload timestamp, direct file download link, and deletion controls.

---

### 3.5 Model Hub (`/app/models/page.tsx`)

Control center for downloading, uploading, and managing open-weight local `.gguf` models:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Model Hub                                                              │
│ [ Downloaded Models (3) ] [ Upload Local Model ] [ Hugging Face Downloader ] │
└────────────────────────────────────────────────────────────────────────┘
```

#### Tab 1: Downloaded Models
* Displays local `.gguf` models stored in the backend `models/` directory.
* Details: Friendly Name, Repo Source, File Path, Format (`gguf`), Quantization (`Q4_K_M`, `Q8_0`), File Size, and Status (`ready` / `downloading`).
* Actions: Delete model (removes weights from disk and database). Direct link to **Manage Runtime** navigation in header banner.

#### Tab 2: Local Device Upload
* Direct browser-to-backend multipart upload for `.gguf` files with drag-and-drop and real-time progress bar.
* **Automatic Metadata Extraction**: Model display name, architecture, context length, and quantization are automatically parsed directly from the GGUF binary headers via `GGUFReader` on the backend without requiring manual operator input.
* Client-side validation: Rejects non-`.gguf` files before network transmission.

#### Tab 3: Hugging Face Downloader
* Input Hugging Face repository ID (e.g. `Qwen/Qwen2.5-Coder-7B-Instruct-GGUF`) and exact `.gguf` filename.
* Background download execution: Tracks download progress while keeping the UI responsive.

---

### 3.6 Model Chat Workspace (`/app/chat/page.tsx`)

A dedicated interactive chat console providing direct conversation, prompt engineering, and autonomous tool calling with local GGUF models without requiring full agent provisioning:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Model Chat                                                             │
│ [ Conversations Sidebar ] [ Model Selector ] [ Real-Time Chat Stream ] │
└────────────────────────────────────────────────────────────────────────┘
```

* **Conversations Sidebar**:
  * Lists previous chat sessions grouped by timestamp with message counters and model badges.
  * Search conversations by title or last message.
  * **[+ New Chat]**: Opens an instant dialog to select a target local GGUF model and custom system instruction.
  * Delete session with confirmation modal.
* **Direct Model Reasoning & Streaming**:
  * Supports real-time token-by-token streaming via Server-Sent Events (SSE) from `POST /api/v1/chat/{id}/stream`.
  * Preserves full conversation context across multi-turn interactions.
* **Autonomous Tool Execution Cards**:
  * Renders visual step-by-step cards when models invoke local tools (e.g. `python_execution`, `read_file`, `web_search`).
  * Displays tool name, parsed arguments JSON, execution latency in milliseconds, and structured return output.
* **Quick Starters**:
  * One-click prompt templates for instant model verification (`Code Assistant`, `System Architecture`, `Reasoning & Logic`, `Data Diagnostic`).
* **Runtime Awareness**:
  * Real-time status indicator showing whether the model server is currently running or starting.

---

### 3.7 Runtime Status & Diagnostics (`/app/runtime/page.tsx`)

Unified status and health supervision center dedicated exclusively to status checking of the **Agent Runtime** and **Model Runtime**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Runtime Status & Diagnostics                                           │
│ [ Agent Runtime Status ]  [ Model Runtime Status & Diagnostics ]       │
└────────────────────────────────────────────────────────────────────────┘
```

#### Tab 1: Agent Runtime Status
* **Active Agent Worker Registry**:
  * Real-time table of all executing agent instances registered in the backend `runtime` database table.
  * Columns: Agent Name, Model Name, Runtime ID, Worker Thread Name (e.g. `agent-8c59f0f6...`), Started At, and Last Heartbeat timestamp.
  * Actions: Instant **Terminate Worker** button to safely abort running agent threads.
* **System Overview & Air-Gapped Metrics**:
  * Active Agents counter.
  * Total Agents configured.
  * Local host loopback binding (`127.0.0.1`).
  * External network egress meter (locked at `0.0 KB`).

#### Tab 2: Model Runtime Status & Diagnostics
* **Live Server Status Card**:
  * Daemon Health: Online / Loading / Offline badge.
  * Process PID, Port, Endpoint URL (`http://127.0.0.1:8080`), and Uptime.
  * Server binary path check (`backend/llama.cpp/bin/Release/llama-server.exe`).
* **Runner Configuration & Controls**:
  * Model Selector (dropdown of ready GGUF models).
  * Port (default `8080`), Context Size (`ctx_size`), GPU Offload Layers (`n_gpu_layers`).
  * One-click **Start Model Server** and **Stop Model Server**.
* **Live Terminal Logs**:
  * Terminal view streaming stdout/stderr from `llama-server.exe` with auto-scroll and manual refresh.
* **Diagnostic Inference Test**:
  * Direct testing console to verify model responsiveness, returning full model response, tokens usage, and end-to-end roundtrip latency in milliseconds.

> *Note: For backwards compatibility, `/operations` seamlessly routes to the unified `/runtime` console.*

---

### 3.8 Settings & Governance (`/app/settings/page.tsx`)

System administration and enterprise configuration:

* **Company & Operational Parameters**:
  * **Company Name**: Configures platform branding.
  * **Max Concurrent Agent Limit**: Sets the maximum number of worker threads allowed to execute concurrently.
  * **API URL**: Backend gateway address (e.g. `http://localhost:8000/api/v1`).
  * **Environment**: Mode badge (`development`, `staging`, `production`).
  * **Default Timeout Seconds**: Global timeout for tool invocations and model calls.
  * **Maintenance Mode**: Toggle to pause background agent triggers.
* **Dynamic Custom Attributes**:
  * Key-value manager to store arbitrary enterprise metadata in the `settings` database table (stored as structured JSON/JSONB).
* **User Directory & RBAC**:
  * View registered operators and system administrators.
  * Form to register new operators with name, email, and password.

---

# 4. Frontend API Client Layer (`frontend/lib/api/`)

The frontend interacts with the backend through modular, strongly typed API modules powered by a configured Axios client (`lib/api/client.ts`).

### 4.1 Token Lifecycle & Interceptor Pattern
* **Request Interceptor**: Automatically reads `access_token` from local storage and injects `Authorization: Bearer <access_token>` into every request header.
* **Response Interceptor**:
  1. Detects `401 Unauthorized` responses.
  2. Queues failed requests while attempting token refresh via `POST /api/v1/users/refresh` using the stored `refresh_token`.
  3. Upon successful refresh, stores the new access and refresh tokens, updates authorization headers, and retries the queued requests.
  4. If the refresh token is invalid or expired, clears session storage and redirects to `/login`.

---

### 4.2 API Modules Reference

| Module | File | Methods | Description |
| :--- | :--- | :--- | :--- |
| `agentsApi` | `lib/api/agents.ts` | `getAgents`, `getAgent`, `createAgent`, `updateAgent`, `deleteAgent`, `runAgent`, `stopAgent`, `getRunningAgents`, `getAgentDocuments` | Full agent lifecycle, interactive execution, and worker supervisor |
| `modelsApi` | `lib/api/models.ts` | `getModels`, `getModel`, `downloadModel`, `uploadModel`, `deleteModel`, `checkLlamaStatus`, `startRuntime`, `stopRuntime`, `getRuntimeStatus`, `getRuntimeLogs` | GGUF model management, HF download, file upload, and llama.cpp runtime |
| `documentsApi` | `lib/api/documents.ts` | `getDocuments`, `getDocument`, `uploadDocument`, `downloadDocument`, `deleteDocument` | Knowledge Vault document ingestion, retrieval, and binary downloads |
| `runtimeApi` | `lib/api/runtime.ts` | `getOverview`, `getModelStatus`, `startModel`, `stopModel`, `getModelLogs`, `testModel`, `getActiveAgents`, `startAgent`, `stopAgent` | Real-time operations overview, model server testing, and worker management |
| `chatApi` | `lib/api/chat.ts` | `listConversations`, `createConversation`, `getConversation`, `deleteConversation`, `sendMessage`, `streamMessage` | Multi-turn model chat sessions, SSE token streaming, and autonomous tool execution |
| `settingsApi` | `lib/api/settings.ts` | `getSettings`, `updateSettings` | Global system settings, company parameters, and custom JSON key-values |
| `usersApi` | `lib/api/users.ts` | `getUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser` | User directory and administrative operator provisioning |
| `authApi` | `lib/api/auth.ts` | `login`, `refresh`, `logout`, `getCurrentUser` | Authentication and session token handling |

---

# 5. TypeScript Data Types (`frontend/lib/api/types.ts`)

Key interfaces powering the frontend:

```typescript
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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string | null;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }> | null;
  tool_results?: Array<{
    tool_name: string;
    result: unknown;
    status: 'success' | 'error';
    execution_time_ms?: number;
  }> | null;
}

export interface ConversationResponse {
  id: string;
  user_id: string;
  model_id?: string | null;
  model_name?: string | null;
  agent_id?: string | null;
  title?: string | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  model_id?: string | null;
  model_name?: string | null;
  title?: string | null;
  message_count: number;
  last_message?: string | null;
  created_at: string;
  updated_at: string;
}
```

---

# 6. Technology Stack & Running Locally

### Technology Stack
* **Framework**: Next.js 15+ (App Router)
* **Language**: TypeScript 5.0+
* **Styling**: Tailwind CSS
* **Icons**: Lucide React
* **HTTP Client**: Axios (with custom JWT interceptors)
* **State Management**: React Context (`AuthProvider`, `ToastProvider`)

### Running Locally
```powershell
cd frontend
npm install
npm run dev
```
The application opens by default at `http://localhost:3000`.
