# Sovereign On-Premise Agentic AI Workbench — Backend

## 1. Main Goal

The backend is the core engine of the platform.

Its primary goal is to:

> **Create, configure, execute, monitor, and manage autonomous AI agents powered by local, open-weight GGUF models running air-gapped on-premise, while providing secure, deterministic access to enterprise data, tools, and scheduled automations.**

The backend guarantees that confidential industrial, engineering, and organizational data never leaves the organization's private infrastructure (0.0 KB egress).

---

## 2. Backend Architecture

```text
                                FRONTEND (Next.js 15+ / React)
                                               │
                                               │ HTTP / REST (JWT Bearer)
                                               ▼
                              ┌─────────────────────────────────┐
                              │       FastAPI API Gateway       │
                              │       (http://.../api/v1)       │
                              └────────────────┬────────────────┘
                                               │
        ┌───────────────────┬──────────────────┼──────────────────┬──────────────────┐
        ▼                   ▼                  ▼                  ▼                  ▼
┌───────────────┐   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ User & Auth   │   │ Agent Manager │  │ AI Model Hub  │  │ RAG / Vector  │  │  Settings &   │
│ Controller    │   │ Controller    │  │ Controller    │  │ Knowledge Hub │  │  Governance   │
└───────┬───────┘   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                   │                  │                  │                  │
        │           ┌───────┴───────┐          │                  │                  │
        │           ▼               ▼          ▼                  ▼                  │
        │    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
        │    │ AgentRuntime │ │ ModelRuntime │ │ llama.cpp    │ │ pgvector /   │     │
        │    │ (Scheduler & │ │ (Subprocess  │ │ llama-server │ │ Chroma       │     │
        │    │  Thread Pool)│ │  Supervisor) │ │ (Native GGUF)│ │ Vector Store │     │
        │    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘     │
        │           │                │                │                │             │
        ▼           ▼                ▼                ▼                ▼             ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                    Relational & Metadata Database (PostgreSQL / SQLite)            │
│  users │ refresh_tokens │ agents │ runtime │ ai_models │ tools │ documents │ ...  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

# 3. Main Backend Components & API Reference

## 3.1 API Layer

Built on **FastAPI** (`backend/app/router.py`), organized into feature modules with Pydantic validation schemas, dependency injection for database sessions (`SessionLocal`), and JWT bearer token authentication.

### Authentication & Security Policy
* **Base URL**: `http://localhost:8000/api/v1`
* **Scheme**: HTTP Bearer JWT (`Authorization: Bearer <access_token>`)
* **Access Token Lifespan**: 30 minutes
* **Refresh Token Lifespan**: 7 days (stored in database with rotation on use)
* **Air-Gapped Policy**: Strict local binding, zero remote telemetry.

---

### 3.1.1 Authentication & User Management Routes (`/api/v1/users`)

#### 1. User Login
* **Method**: `POST`
* **Path**: `/api/v1/users/login`
* **Auth Required**: No
* **Request Body**:
```json
{
  "email": "user@example.com",
  "password": "secretpassword123"
}
```
* **Response `200 OK`**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "4eZpYQhF8s9bT1aW-9mK...",
  "token_type": "bearer",
  "expires_in": 1800
}
```
* **Error `401 Unauthorized`**:
```json
{
  "detail": "Invalid email or password"
}
```

#### 2. Refresh Access Token
* **Method**: `POST`
* **Path**: `/api/v1/users/refresh`
* **Auth Required**: No
* **Request Body**:
```json
{
  "refresh_token": "4eZpYQhF8s9bT1aW-9mK..."
}
```
* **Response `200 OK`**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "9xLpAQhF2s7bT5vK-1mR...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

#### 3. User Logout
* **Method**: `POST`
* **Path**: `/api/v1/users/logout`
* **Auth Required**: No
* **Request Body**:
```json
{
  "refresh_token": "9xLpAQhF2s7bT5vK-1mR..."
}
```
* **Response `204 No Content`**

#### 4. Get Current User Profile
* **Method**: `GET`
* **Path**: `/api/v1/users/me`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `200 OK`**:
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "created_at": "2026-09-03T14:20:00Z"
}
```

#### 5. List Users
* **Method**: `GET`
* **Path**: `/api/v1/users/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Query Parameters**: `skip` (int, default: 0), `limit` (int, default: 100)
* **Response `200 OK`**: Array of `User` objects.

#### 6. Create User
* **Method**: `POST`
* **Path**: `/api/v1/users/`
* **Auth Required**: No (or Admin)
* **Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword123"
}
```
* **Response `201 Created`**: Single user object.

#### 7. Update User
* **Method**: `PUT` or `PATCH`
* **Path**: `/api/v1/users/{user_id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Request Body**: Optional `name`, `email`, `password`.

#### 8. Delete User
* **Method**: `DELETE`
* **Path**: `/api/v1/users/{user_id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `204 No Content`**

---

### 3.1.2 Agent Management Routes (`/api/v1/agents`)

The agent engine supports autonomous triggers, scheduling expressions, tool registries, document knowledge bindings, and concurrency limits.

#### 1. List Agents
* **Method**: `GET`
* **Path**: `/api/v1/agents/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Query Parameters**: `skip` (default: 0), `limit` (default: 100)
* **Response `200 OK`**:
```json
[
  {
    "id": "8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
    "owner_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Daily Sales Analyst",
    "description": "Analyzes ERP sales data and drafts daily summaries",
    "instructions": "Analyze the latest sales data and generate a summary report.",
    "model_id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
    "model": "TinyLlama 1.1B Chat (Q4_K_M)",
    "ai_model": {
      "id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
      "name": "TinyLlama 1.1B Chat (Q4_K_M)",
      "repo_id": "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
      "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
      "file_path": "models/TheBloke--TinyLlama-1.1B-Chat-v1.0-GGUF/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
      "format": "gguf",
      "quantization": "Q4_K_M",
      "size_bytes": 669229056,
      "status": "ready"
    },
    "trigger": "schedule",
    "schedule": "every 1 day at 09:00",
    "max_execution_time": 10,
    "max_tool_calls": 50,
    "concurrency": 1,
    "retries": 3,
    "is_running": false,
    "created_at": "2026-09-03T14:30:00Z",
    "updated_at": "2026-09-03T14:30:00Z",
    "tools": [
      {
        "id": "7b59f0f6-d703-4b68-b808-fa2fa1a6a2aa",
        "name": "Database",
        "description": "Query relational tables and execute structured analytics",
        "handler": "default_database_query"
      },
      {
        "id": "7b59f0f6-d703-4b68-b808-fa2fa1a6a2bb",
        "name": "Documents",
        "description": "Perform semantic vector retrieval across uploaded knowledge",
        "handler": "default_document_search"
      }
    ],
    "documents": [
      {
        "id": "1fa85f64-5717-4562-b3fc-2c963f66afa1",
        "name": "Q3_Sales_Report.pdf",
        "file_path": "uploads/Q3_Sales_Report.pdf",
        "mime_type": "application/pdf",
        "created_at": "2026-09-03T14:25:00Z"
      }
    ]
  }
]
```

#### 2. Create Agent
* **Method**: `POST`
* **Path**: `/api/v1/agents/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Request Body**:
```json
{
  "name": "Daily Sales Analyst",
  "description": "Analyzes ERP sales data and drafts daily summaries",
  "instructions": "Analyze the latest sales data and generate a summary report.",
  "model_id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
  "trigger": "schedule",
  "schedule": "every 1 day at 09:00",
  "max_execution_time": 10,
  "max_tool_calls": 50,
  "concurrency": 1,
  "retries": 3,
  "tools": ["Database", "Documents"],
  "document_ids": ["1fa85f64-5717-4562-b3fc-2c963f66afa1"]
}
```
*(Aliases supported: `ai_model_id` for `model_id`; `system_instructions` for `instructions`; `trigger_type` for `trigger`)*
* **Response `201 Created`**: AgentResponse object.

#### 3. Get Agent Details
* **Method**: `GET`
* **Path**: `/api/v1/agents/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `200 OK`**: AgentResponse object with populated `ai_model`, `tools`, `documents`, and computed `is_running`.

#### 4. Update Agent
* **Method**: `PUT` or `PATCH`
* **Path**: `/api/v1/agents/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Request Body**: Any subset of `AgentUpdate` fields (`name`, `instructions`, `model_id`, `trigger`, `schedule`, `max_execution_time`, `max_tool_calls`, `concurrency`, `retries`, `tools`, `document_ids`).
* **Response `200 OK`**: Updated AgentResponse object.

#### 5. Delete Agent
* **Method**: `DELETE`
* **Path**: `/api/v1/agents/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `204 No Content`**

#### 6. Run Agent Execution (Interactive / On-Demand)
* **Method**: `POST`
* **Path**: `/api/v1/agents/{id}/run`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Request Body**:
```json
{
  "prompt": "Analyze vibration sensor readings in Section B against the manual.",
  "conversation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "auto_restart": true
}
```
* **Response `200 OK`**:
```json
{
  "execution_id": "e4eaaaf2-d142-11e1-b3e4-080027620cdd",
  "agent_id": "8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
  "status": "completed",
  "response": "Analysis indicates bearings in Section B are within 4% of nominal operating vibration.",
  "tool_calls": [
    {
      "name": "Documents",
      "arguments": {"query": "vibration tolerances Section B"},
      "result": "Found 2 excerpts in Maintenance_Manual.pdf",
      "status": "success"
    }
  ],
  "completed_at": "2026-09-03T14:45:10Z"
}
```

#### 7. Stop Agent Execution
* **Method**: `POST`
* **Path**: `/api/v1/agents/{id}/stop`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Request Body** *(Optional)*:
```json
{
  "execution_id": "e4eaaaf2-d142-11e1-b3e4-080027620cdd"
}
```
* **Response `200 OK`**:
```json
{
  "execution_id": "e4eaaaf2-d142-11e1-b3e4-080027620cdd",
  "agent_id": "8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
  "status": "stopped",
  "message": "Agent execution stopped successfully",
  "stopped_at": "2026-09-03T14:46:00Z"
}
```

#### 8. List Running Agents (Active Supervisor)
* **Method**: `GET`
* **Path**: `/api/v1/agents/running`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `200 OK`**: Returns `list[AgentResponse]` for all agents currently registered with active worker threads in the `runtime` table (`is_running = true`).

#### 9. Get Agent Documents
* **Method**: `GET`
* **Path**: `/api/v1/agents/{id}/documents`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `200 OK`**: List of attached documents.

---

### 3.1.3 AI Model Management Routes (`/api/v1/models`)

Supports open-weight `.gguf` models downloaded from Hugging Face or uploaded directly from the operator's machine.

#### 1. Upload Local GGUF Model File
* **Method**: `POST`
* **Path**: `/api/v1/models/upload`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Content-Type**: `multipart/form-data`
* **Form Parameters**:
  * `file`: (binary `.gguf` file)
* **Metadata Extraction**: Uploaded `.gguf` binaries are automatically inspected by `GGUFReader` to extract the model's internal name, architecture, and dominant tensor quantization format before creating the database entry. Manual entry of name and quantization is not required.
* **Response `201 Created`**:
```json
{
  "id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
  "name": "Qwen 2.5 7B Instruct (Q4_K_M)",
  "repo_id": "local-upload",
  "filename": "qwen2.5-7b-instruct-q4_k_m.gguf",
  "file_path": "models/local-upload/qwen2.5-7b-instruct-q4_k_m.gguf",
  "format": "gguf",
  "size_bytes": 4681282048,
  "quantization": "Q4_K_M",
  "status": "ready",
  "error_message": null,
  "created_at": "2026-09-03T15:00:00Z",
  "updated_at": "2026-09-03T15:00:00Z"
}
```
* **Constraints**: Rejects non-`.gguf` files with `400 Bad Request`.

#### 2. Download Model from Hugging Face
* **Method**: `POST`
* **Path**: `/api/v1/models/download`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Query Parameters**: `background` (bool, default: true)
* **Request Body**:
```json
{
  "repo_id": "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
  "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
  "name": "TinyLlama 1.1B Chat (Q4_K_M)",
  "quantization": "Q4_K_M"
}
```
* **Response `202 Accepted`**: Model metadata with initial `downloading` status. Background thread fetches weights and updates status to `ready`.

#### 3. List Downloaded AI Models
* **Method**: `GET`
* **Path**: `/api/v1/models/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `200 OK`**: List of all registered AIModel objects.

#### 4. Check llama-server Installation & Models
* **Method**: `GET`
* **Path**: `/api/v1/models/status` (or `/api/v1/models/check`)
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `200 OK`**:
```json
{
  "installed": true,
  "message": "llama.cpp is installed",
  "server_path": "D:\\Code\\mix\\Agentic-AI-Workbench\\backend\\llama.cpp\\bin\\Release\\llama-server.exe",
  "models": [ ... ]
}
```

#### 5. Start / Stop / Inspect llama-server via Model Routes
* **Start Runtime**: `POST /api/v1/models/runtime/start`
  * Body: `{"model": "qwen2.5", "port": 8080, "host": "127.0.0.1", "ctx_size": 4096, "n_gpu_layers": 99, "threads": 8}`
* **Stop Runtime**: `POST /api/v1/models/runtime/stop`
* **Get Runtime Status**: `GET /api/v1/models/runtime/status`
* **Get Runtime Logs**: `GET /api/v1/models/runtime/logs?lines=100`

#### 6. Delete AI Model
* **Method**: `DELETE`
* **Path**: `/api/v1/models/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `204 No Content`**: Removes model file from disk and deletes database record.

---

### 3.1.4 Knowledge / Document Routes (`/api/v1/documents`)

Manages company documents used by agents for Retrieval-Augmented Generation (RAG).

#### 1. Upload Knowledge Document
* **Method**: `POST`
* **Path**: `/api/v1/documents/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Content-Type**: `multipart/form-data`
* **Form Fields**: `file` (PDF, DOCX, TXT)
* **Response `201 Created`**:
```json
{
  "id": "1fa85f64-5717-4562-b3fc-2c963f66afa1",
  "name": "machine_manual.pdf",
  "filename": "machine_manual.pdf",
  "file_path": "uploads/a1b2c3d4_machine_manual.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 1048576,
  "status": "indexed",
  "created_at": "2026-09-03T14:50:00Z"
}
```

#### 2. List Documents
* **Method**: `GET`
* **Path**: `/api/v1/documents/`
* **Response `200 OK`**: Array of document records.

#### 3. Download Document
* **Method**: `GET`
* **Path**: `/api/v1/documents/{id}/download`
* **Response `200 OK`**: Binary file stream.

#### 4. Delete Document
* **Method**: `DELETE`
* **Path**: `/api/v1/documents/{id}`
* **Response `204 No Content`**

---

### 3.1.5 Runtime Management Routes (`/api/v1/runtime`)

Provides unified supervision for the active local model server and background agent worker threads.

#### 1. Runtime Overview
* **Method**: `GET`
* **Path**: `/api/v1/runtime/overview`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Response `200 OK`**:
```json
{
  "llama_installed": true,
  "llama_server_path": "D:\\Code\\mix\\Agentic-AI-Workbench\\backend\\llama.cpp\\bin\\Release\\llama-server.exe",
  "model_runtime": {
    "running": true,
    "ready": true,
    "pid": 14280,
    "model_path": "models/local-upload/qwen2.5-7b.gguf",
    "model_name": "qwen2.5-7b",
    "host": "127.0.0.1",
    "port": 8080,
    "ctx_size": 4096,
    "n_gpu_layers": 99,
    "threads": 8,
    "base_url": "http://127.0.0.1:8080",
    "health_url": "http://127.0.0.1:8080/health",
    "uptime_seconds": 124.5
  },
  "active_agents_count": 1,
  "active_agents": [
    {
      "id": "cfa044e9-eac5-4ca2-a6f9-0123456789ab",
      "agent_id": "8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
      "agent_name": "Daily Sales Analyst",
      "agent_model": "TinyLlama 1.1B Chat (Q4_K_M)",
      "status": "running",
      "thread_name": "agent-8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
      "started_at": "2026-09-03T15:10:00Z",
      "last_heartbeat": "2026-09-03T15:12:30Z"
    }
  ]
}
```

#### 2. Get Model Server Status
* **Method**: `GET`
* **Path**: `/api/v1/runtime/models/status`
* **Response `200 OK`**: Detailed `ModelRuntimeStatusResponse`.

#### 3. Start Model Server
* **Method**: `POST`
* **Path**: `/api/v1/runtime/models/start`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Request Body**:
```json
{
  "model": "TinyLlama 1.1B Chat (Q4_K_M)",
  "port": 8080,
  "host": "127.0.0.1",
  "ctx_size": 4096,
  "n_gpu_layers": 99,
  "threads": 8,
  "wait_ready": true,
  "timeout": 30.0
}
```
* **Response `200 OK`**: ModelRuntimeStatusResponse.

#### 4. Stop Model Server
* **Method**: `POST`
* **Path**: `/api/v1/runtime/models/stop`
* **Response `200 OK`**: Updated status with `running: false`.

#### 5. Get Model Server Logs
* **Method**: `GET`
* **Path**: `/api/v1/runtime/models/logs?lines=100`
* **Response `200 OK`**: `{"logs": ["line 1", "line 2", ...]}`

#### 6. Test Model Inference
* **Method**: `POST`
* **Path**: `/api/v1/runtime/models/test`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Request Body**:
```json
{
  "prompt": "Explain sovereign agentic AI in two sentences.",
  "max_tokens": 128,
  "temperature": 0.7
}
```
* **Response `200 OK`**:
```json
{
  "success": true,
  "response": "Sovereign agentic AI ensures all data processing and reasoning remain completely on-premises. It prevents enterprise leaks by running local open-weight models without cloud dependencies.",
  "latency_ms": 342.15,
  "model": "TinyLlama 1.1B Chat (Q4_K_M)",
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 36,
    "total_tokens": 50
  }
}
```

#### 7. Active Agent Runtime Operations
* **List Active Agents**: `GET /api/v1/runtime/agents`
* **Start Agent Thread**: `POST /api/v1/runtime/agents/{agent_id}/start`
* **Stop Agent Thread**: `POST /api/v1/runtime/agents/{agent_id}/stop`

---

### 3.1.6 Settings & Governance Routes (`/api/v1/settings`)

Stores application-wide system configurations, limits, and customizable JSON key-value attributes.

#### 1. Get System Settings
* **Method**: `GET`
* **Path**: `/api/v1/settings/`
* **Response `200 OK`**:
```json
{
  "id": "c5ca4a9c-833c-4a33-8a33-abcdef123456",
  "key": "general",
  "data": {
    "company_name": "Agentic AI Workbench",
    "max_concurrent_agent_limit": 10,
    "api_url": "http://localhost:8000/api/v1",
    "environment": "development",
    "default_timeout_seconds": 60,
    "maintenance_mode": false,
    "extra_values": {
      "cluster_node_id": "AIRGAP-NODE-01",
      "default_gpu_offload": "CUDA_ALL"
    }
  },
  "created_at": "2026-09-03T12:00:00Z",
  "updated_at": "2026-09-03T12:00:00Z"
}
```

#### 2. Update System Settings
* **Method**: `PUT`
* **Path**: `/api/v1/settings/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Request Body**:
```json
{
  "company_name": "Industrial AI Labs",
  "max_concurrent_agent_limit": 16,
  "api_url": "http://localhost:8000/api/v1",
  "environment": "production",
  "default_timeout_seconds": 90,
  "maintenance_mode": false,
  "extra_values": {
    "security_level": "RESTRICTED",
    "backup_interval_hrs": "6"
  }
}
```
* **Response `200 OK`**: Updated SettingsResponse object.

---

# 4. Agent & Model Runtime Architecture

The workbench uses a dual-engine architecture separating model serving from agent orchestration:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        AGENT RUNTIME SUPERVISOR                        │
│                                                                        │
│   check_triggers() (Every 60s ticker)                                  │
│         │                                                              │
│         ├─► is_agent_due() (cron parser / interval parser)             │
│         │                                                              │
│         └─► execute_agent(agent_id)                                    │
│                 │                                                      │
│                 ├─► Register thread in `runtime` table                 │
│                 ├─► Load system prompt + attached documents            │
│                 ├─► Query ModelRuntime OpenAI endpoint                 │
│                 ├─► Deterministic Tool Execution Loop (DB / Docs)      │
│                 └─► Complete & clear `runtime` instance record         │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        MODEL RUNTIME SUPERVISOR                        │
│                                                                        │
│   subprocess: llama-server.exe (backend/llama.cpp)                     │
│         │                                                              │
│         ├── CLI parameters: -m [path.gguf] -c 4096 -ngl 99 -t 8        │
│         ├── Health Probe: GET http://127.0.0.1:8080/health             │
│         ├── In-Memory Log Ring Buffer (500 lines)                      │
│         └── OpenAI-compatible endpoint: /v1/chat/completions           │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 ModelRuntime (`backend/app/runtime/model_runtime.py`)
* Manages a dedicated background subprocess running `llama-server.exe`.
* Automatically resolves model paths across `models/` directory, Hugging Face subdirectories (`models/{repo}--{id}`), and database UUID lookups.
* Captures standard output and error into a thread-safe `deque(maxlen=500)` buffer accessible via `/api/v1/runtime/models/logs`.
* Exposes non-blocking readiness checks (`wait_until_ready`), process PID inspection, and uptime tracking.

### 4.2 AgentRuntime (`backend/app/runtime/agent_runtime.py`)
* Background daemon thread monitoring scheduled agents.
* Evaluates `trigger` types:
  * `manual`: Triggered on-demand via UI or API.
  * `schedule`: Periodic intervals (e.g. `every 1 day at 09:00`, `every 4 hours`) or standard 5-part cron syntax via `schedule_parser.py`.
  * `onetime`: Fires once at a specified ISO datetime stamp.
* Enforces concurrency slots and tracks execution threads in the `runtime` database table.

---

# 5. Local / Open-Weight Model Layer

The platform is strictly optimized for **GGUF (GPT-Generated Unified Format)** models executed through native `llama.cpp`.

### Build & Compilation Automation
The script `backend/build_llama.ps1` automates compiling `llama.cpp` natively for Windows:
```powershell
powershell -ExecutionPolicy Bypass -File backend/build_llama.ps1
```
It supports:
* CPU with AVX / AVX2 / AVX512 vectorization.
* GPU offloading via CUDA (NVIDIA) or Vulkan.
* Binary artifacts output to `backend/llama.cpp/bin/Release/llama-server.exe`.

---

# 6. Tool System

Agents dynamically call registered deterministic tools:
1. **Database**: Executes safe SQL statements against designated enterprise operational tables.
2. **Documents**: Performs vector similarity search over embedded company knowledge files.
3. **Email**: Formats and dispatches notification drafts to designated operational recipients.
4. **File Reader**: Reads raw files from restricted workspace storage.

Tools are permission-controlled via the `agent_tools` association table. Agents can only call tools explicitly assigned during agent configuration.

---

# 7. Knowledge / RAG Pipeline

* Documents (PDF, DOCX, TXT) are uploaded through `/api/v1/documents/`.
* Content is extracted, chunked, and embedded using a local embedding model.
* Embedded vectors are stored in PostgreSQL with `pgvector` or Chroma.
* When an agent with document access receives a task, the runtime performs cosine similarity retrieval, augmenting the LLM prompt with relevant context snippets while keeping all documents on-premise.

---

# 8. Relational Database Schema

Managed via SQLAlchemy and Alembic migrations:

| Table Name | Description | Key Columns |
| :--- | :--- | :--- |
| `users` | System operators and admins | `id`, `name`, `email`, `hashed_password`, `created_at` |
| `refresh_tokens` | Single-use rotating refresh tokens | `id`, `user_id`, `token`, `expires_at`, `revoked` |
| `agents` | AI agent configurations | `id`, `owner_id`, `name`, `instructions`, `model_id`, `trigger`, `schedule`, `max_execution_time`, `max_tool_calls`, `concurrency`, `retries` |
| `runtime` | Currently executing agent threads | `id`, `agent_id`, `status`, `thread_name`, `started_at`, `last_heartbeat`, `configuration` |
| `ai_models` | Downloaded / uploaded GGUF models | `id`, `name`, `repo_id`, `filename`, `file_path`, `format`, `quantization`, `size_bytes`, `status` |
| `tools` | Registered system capabilities | `id`, `name`, `description`, `handler` |
| `agent_tools` | Agent-to-tool permissions mapping | `agent_id`, `tool_id` |
| `documents` | Uploaded knowledge files | `id`, `name`, `file_path`, `mime_type`, `size_bytes`, `status` |
| `agent_documents` | Agent-to-document bindings | `agent_id`, `document_id` |
| `settings` | System-wide config and JSONB values | `id`, `key`, `data` (JSON/JSONB), `created_at`, `updated_at` |
| `conversations` | Chat and execution sessions | `id`, `agent_id`, `user_id`, `title`, `created_at` |
| `messages` | Execution dialog messages | `id`, `conversation_id`, `role`, `content`, `created_at` |
| `executions` | Completed execution logs | `id`, `agent_id`, `status`, `response`, `tool_calls`, `completed_at` |

---

# 9. Security & Air-Gapped Operation

1. **Zero External Telemetry**: All network operations bind to loopback (`127.0.0.1`) or private enterprise subnet IPs.
2. **Deterministic Tool Sandboxing**: Agents cannot call arbitrary shell commands; only whitelisted Python handlers registered in `tools` are invocable.
3. **Session Revocation**: Compromised refresh tokens are immediately revoked via database token rotation.
4. **Local Model Integrity**: GGUF model files are stored locally and validated for file headers before loading into memory.

---

# 10. Technology Stack Summary

* **Runtime Language**: Python 3.12+
* **Framework**: FastAPI + Uvicorn
* **ORM & Database**: SQLAlchemy 2.0, Alembic, PostgreSQL / SQLite
* **Local LLM Engine**: Native `llama.cpp` (`llama-server.exe`)
* **Package Management**: `uv` / `pip`
* **Model Format**: `.gguf` (Quantized Q4_K_M, Q5_K_M, Q8_0, etc.)
