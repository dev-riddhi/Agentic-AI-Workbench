# Sovereign On-Premise Agentic AI Workbench — Backend

## 1. Main Goal

The backend is the core of the platform.

Its primary goal is to:

> **Create, configure, execute, and manage AI agents that use open-weight models locally while allowing agents to securely access company data and tools.**

The backend should ensure that confidential industrial data can remain inside the company's infrastructure.

---

## 2. Backend Architecture

```text
                         FRONTEND
                            │
                            ▼
                    ┌───────────────┐
                    │    FastAPI    │
                    │   REST API    │
                    └───────┬───────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
         Agent Manager  Agent Runtime  Document
                                      Manager
                │           │           │
                │           │           ▼
                │           │      RAG Pipeline
                │           │           │
                │           │      Vector DB
                │           │
                │     ┌─────┴─────┐
                │     │           │
                ▼     ▼           ▼
             Database Tools   Local LLM
                       │           │
                       ▼           ▼
                  Internal     Ollama /
                  Systems      vLLM / llama.cpp
```

---

# 3. Main Backend Components

## 3.1 API Layer

Use **FastAPI** as the main backend API.

Responsibilities:

* Receive frontend requests
* Validate requests
* Authenticate users
* Manage agents
* Manage documents
* Start agent executions
* Return results

### Authentication & Security

* **Base URL**: `http://localhost:8000/api/v1`
* **Scheme**: HTTP Bearer JWT (`Authorization: Bearer <access_token>`)
* **Token Lifespan**: Access Token (30 mins), Refresh Token (7 days)
* **Refresh Token Rotation**: Refresh tokens are single-use and rotated on every refresh call.

---

### 3.1.1 Authentication & User Management Routes

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

---

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
* **Error `401 Unauthorized`**:
```json
{
  "detail": "Invalid, expired, or revoked refresh token"
}
```

---

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

---

#### 4. Get Current User Profile
* **Method**: `GET`
* **Path**: `/api/v1/users/me`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Response `200 OK`**:
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "created_at": "2026-09-03T14:20:00Z"
}
```
* **Error `401 Unauthorized`**:
```json
{
  "detail": "Could not validate credentials"
}
```

---

#### 5. Create User
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
* **Response `201 Created`**:
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "created_at": "2026-09-03T14:20:00Z"
}
```
* **Error `400 Bad Request`**:
```json
{
  "detail": "Email already registered"
}
```

---

#### 6. List Users
* **Method**: `GET`
* **Path**: `/api/v1/users/`
* **Query Parameters**:
  * `skip` (integer, default: 0)
  * `limit` (integer, default: 100)
* **Response `200 OK`**:
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "created_at": "2026-09-03T14:20:00Z"
  }
]
```

---

#### 7. Get User by ID
* **Method**: `GET`
* **Path**: `/api/v1/users/{user_id}`
* **Path Parameters**: `user_id` (UUID)
* **Response `200 OK`**:
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "created_at": "2026-09-03T14:20:00Z"
}
```
* **Error `404 Not Found`**:
```json
{
  "detail": "User not found"
}
```

---

#### 8. Update User
* **Method**: `PUT` or `PATCH`
* **Path**: `/api/v1/users/{user_id}`
* **Path Parameters**: `user_id` (UUID)
* **Request Body**:
```json
{
  "name": "Jane Updated",
  "email": "jane.updated@example.com",
  "password": "newpassword123"
}
```
*(All fields are optional)*
* **Response `200 OK`**:
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Jane Updated",
  "email": "jane.updated@example.com",
  "created_at": "2026-09-03T14:20:00Z"
}
```
* **Error `400 Bad Request`**:
```json
{
  "detail": "Email already registered"
}
```
* **Error `404 Not Found`**:
```json
{
  "detail": "User not found"
}
```

---

#### 9. Delete User
* **Method**: `DELETE`
* **Path**: `/api/v1/users/{user_id}`
* **Path Parameters**: `user_id` (UUID)
* **Response `204 No Content`**
* **Error `404 Not Found`**:
```json
{
  "detail": "User not found"
}
```

---

### 3.1.2 Agent Management Routes

#### 1. List Agents
* **Method**: `GET`
* **Path**: `/api/v1/agents/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Query Parameters**:
  * `skip` (integer, default: 0)
  * `limit` (integer, default: 100)
* **Response `200 OK`**:
```json
[
  {
    "id": "8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
    "owner_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Maintenance Agent",
    "description": "Industrial maintenance assistant",
    "instructions": "Help analyze machine maintenance problems.",
    "model": "qwen",
    "created_at": "2026-09-03T14:30:00Z",
    "updated_at": "2026-09-03T14:30:00Z",
    "tools": [
      {
        "id": "7b59f0f6-d703-4b68-b808-fa2fa1a6a2aa",
        "name": "document_search",
        "description": "Searches embedded company documents",
        "handler": "default_document_search"
      }
    ],
    "documents": []
  }
]
```

---

#### 2. Create Agent
* **Method**: `POST`
* **Path**: `/api/v1/agents/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Request Body**:
```json
{
  "name": "Maintenance Agent",
  "description": "Industrial maintenance assistant",
  "instructions": "Help analyze machine maintenance problems.",
  "model_id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
  "tools": ["document_search", "file_reader"],
  "document_ids": ["1fa85f64-5717-4562-b3fc-2c963f66afa1"]
}
```
*(Note: `ai_model_id` is accepted as an alias for `model_id`; `system_instructions` is accepted as an alias for `instructions`)*
* **Response `201 Created`**:
```json
{
  "id": "8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
  "owner_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Maintenance Agent",
  "description": "Industrial maintenance assistant",
  "instructions": "Help analyze machine maintenance problems.",
  "model_id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
  "model": "TinyLlama 1.1B Chat (Q4_K_M)",
  "ai_model": {
    "id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
    "name": "TinyLlama 1.1B Chat (Q4_K_M)",
    "repo_id": "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
    "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
    "file_path": "models/TheBloke--TinyLlama-1.1B-Chat-v1.0-GGUF/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
    "format": "gguf",
    "status": "ready"
  },
  "created_at": "2026-09-03T14:30:00Z",
  "updated_at": "2026-09-03T14:30:00Z",
  "tools": [
    {
      "id": "7b59f0f6-d703-4b68-b808-fa2fa1a6a2aa",
      "name": "document_search",
      "description": "Tool for document_search",
      "handler": "default_document_search"
    },
    {
      "id": "7b59f0f6-d703-4b68-b808-fa2fa1a6a2bb",
      "name": "file_reader",
      "description": "Tool for file_reader",
      "handler": "default_file_reader"
    }
  ],
  "documents": [
    {
      "id": "1fa85f64-5717-4562-b3fc-2c963f66afa1",
      "name": "machine_manual.pdf",
      "file_path": "uploads/machine_manual.pdf",
      "mime_type": "application/pdf",
      "created_at": "2026-09-03T14:25:00Z"
    }
  ]
}
```

---

#### 3. Get Agent Details
* **Method**: `GET`
* **Path**: `/api/v1/agents/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Response `200 OK`**: Single agent object with `model_id` and nested `ai_model` metadata.
* **Error `404 Not Found`**:
```json
{
  "detail": "Agent not found"
}
```

---

#### 4. Update Agent
* **Method**: `PUT` or `PATCH`
* **Path**: `/api/v1/agents/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Request Body**:
```json
{
  "name": "Maintenance Agent v2",
  "description": "Updated maintenance assistant",
  "instructions": "Diagnose machine anomalies and suggest repair procedures.",
  "model_id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
  "tools": ["document_search", "python_calculator"],
  "document_ids": ["1fa85f64-5717-4562-b3fc-2c963f66afa1"]
}
```
*(All fields are optional)*
* **Response `200 OK`**: Single agent object with updated details and `model_id`.
* **Error `404 Not Found`**:
```json
{
  "detail": "Agent not found"
}
```

---

#### 5. Delete Agent
* **Method**: `DELETE`
* **Path**: `/api/v1/agents/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Response `204 No Content`**
* **Error `404 Not Found`**:
```json
{
  "detail": "Agent not found"
}
```

---

#### 6. Run Agent Execution
* **Method**: `POST`
* **Path**: `/api/v1/agents/{id}/run`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Request Body**:
```json
{
  "prompt": "Analyze vibration sensor readings in Section B and check against the manual.",
  "conversation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```
* **Response `200 OK`**:
```json
{
  "execution_id": "e4eaaaf2-d142-11e1-b3e4-080027620cdd",
  "agent_id": "8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
  "status": "completed",
  "response": "Agent 'Maintenance Agent' completed execution for prompt: Analyze vibration sensor readings in Section B and check against the manual.",
  "tool_calls": [],
  "completed_at": "2026-09-03T14:45:10Z"
}
```
* **Error `404 Not Found`**:
```json
{
  "detail": "Agent not found"
}
```

---

#### 7. Stop Agent Execution
* **Method**: `POST`
* **Path**: `/api/v1/agents/{id}/stop`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
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
  "message": "Execution for agent 'Maintenance Agent' stopped successfully",
  "stopped_at": "2026-09-03T14:46:00Z"
}
```
* **Error `404 Not Found`**:
```json
{
  "detail": "Agent not found"
}
```

---

#### 8. List Running Agents (System Recovery)
* **Method**: `GET`
* **Path**: `/api/v1/agents/running`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Query Parameters**:
  * `auto_restart_only` (boolean, default: false)
* **Response `200 OK`**:
```json
[
  {
    "id": "2da85f64-5717-4562-b3fc-2c963f66afa3",
    "agent_id": "8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
    "status": "running",
    "auto_restart": true,
    "started_at": "2026-09-03T14:45:10Z",
    "last_heartbeat": "2026-09-03T14:55:00Z",
    "configuration": "{\"prompt\": \"Monitor production line\"}"
  }
]
```

---

#### 9. Get Agent Documents
* **Method**: `GET`
* **Path**: `/api/v1/agents/{id}/documents`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Response `200 OK`**:
```json
[
  {
    "id": "1fa85f64-5717-4562-b3fc-2c963f66afa1",
    "name": "machine_manual.pdf",
    "file_path": "uploads/machine_manual.pdf",
    "mime_type": "application/pdf",
    "created_at": "2026-09-03T14:50:00Z"
  }
]
```
* **Error `404 Not Found`**:
```json
{
  "detail": "Agent not found"
}
```

---

### 3.1.3 AI Model Management Routes (GGUF Hugging Face)

#### 1. Download Model from Hugging Face
* **Method**: `POST`
* **Path**: `/api/v1/models/download`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Constraints**: **Only `.gguf` model files are supported**. Any non-`.gguf` filename is rejected with `400/422 Unprocessable Entity`.
* **Query Parameters**:
  * `background` (boolean, default: true)
* **Request Body**:
```json
{
  "repo_id": "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
  "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
  "name": "TinyLlama 1.1B Chat (Q4_K_M)",
  "quantization": "Q4_K_M"
}
```
*(Note: `name` and `quantization` are optional and will be inferred from filename if omitted)*
* **Response `202 Accepted`**:
```json
{
  "id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
  "name": "TinyLlama 1.1B Chat (Q4_K_M)",
  "repo_id": "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
  "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
  "file_path": "models/TheBloke--TinyLlama-1.1B-Chat-v1.0-GGUF/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
  "format": "gguf",
  "size_bytes": 669229056,
  "quantization": "Q4_K_M",
  "status": "ready",
  "error_message": null,
  "created_at": "2026-09-03T15:00:00Z",
  "updated_at": "2026-09-03T15:02:10Z"
}
```
* **Error `400 / 422 Bad Request`** (Non-GGUF file):
```json
{
  "detail": "Only .gguf model files are supported"
}
```

---

#### 2. List Downloaded AI Models
* **Method**: `GET`
* **Path**: `/api/v1/models/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Query Parameters**:
  * `skip` (integer, default: 0)
  * `limit` (integer, default: 100)
* **Response `200 OK`**:
```json
[
  {
    "id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
    "name": "TinyLlama 1.1B Chat (Q4_K_M)",
    "repo_id": "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
    "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
    "file_path": "models/TheBloke--TinyLlama-1.1B-Chat-v1.0-GGUF/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
    "format": "gguf",
    "size_bytes": 669229056,
    "quantization": "Q4_K_M",
    "status": "ready",
    "error_message": null,
    "created_at": "2026-09-03T15:00:00Z",
    "updated_at": "2026-09-03T15:02:10Z"
  }
]
```

---

#### 3. Get AI Model Details
* **Method**: `GET`
* **Path**: `/api/v1/models/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Response `200 OK`**:
```json
{
  "id": "594d7346-a772-4dc5-bfb3-f43a805d12ba",
  "name": "TinyLlama 1.1B Chat (Q4_K_M)",
  "repo_id": "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
  "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
  "file_path": "models/TheBloke--TinyLlama-1.1B-Chat-v1.0-GGUF/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
  "format": "gguf",
  "size_bytes": 669229056,
  "quantization": "Q4_K_M",
  "status": "ready",
  "error_message": null,
  "created_at": "2026-09-03T15:00:00Z",
  "updated_at": "2026-09-03T15:02:10Z"
}
```
* **Error `404 Not Found`**:
```json
{
  "detail": "AI Model not found"
}
```

---

#### 4. Delete AI Model
* **Method**: `DELETE`
* **Path**: `/api/v1/models/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Response `204 No Content`**
* **Error `404 Not Found`**:
```json
{
  "detail": "AI Model not found"
}
```

---

### 3.1.4 Knowledge / Document Routes

#### 2. Upload Knowledge Document
* **Method**: `POST`
* **Path**: `/api/v1/documents/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Content-Type**: `multipart/form-data`
* **Form Fields**:
  * `file`: (binary document: PDF, DOCX, TXT)
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

---

#### 3. List Documents
* **Method**: `GET`
* **Path**: `/api/v1/documents/`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Query Parameters**:
  * `skip` (integer, default: 0)
  * `limit` (integer, default: 100)
* **Response `200 OK`**:
```json
[
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
]
```

---

#### 4. Get Document Details
* **Method**: `GET`
* **Path**: `/api/v1/documents/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Response `200 OK`**:
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
* **Error `404 Not Found`**:
```json
{
  "detail": "Document not found"
}
```

---

#### 5. Download Document
* **Method**: `GET`
* **Path**: `/api/v1/documents/{id}/download`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Response `200 OK`**: Binary file stream with `Content-Disposition: attachment; filename="machine_manual.pdf"`
* **Error `404 Not Found`**:
```json
{
  "detail": "Document not found"
}
```

---

#### 6. Delete Document
* **Method**: `DELETE`
* **Path**: `/api/v1/documents/{id}`
* **Auth Required**: Yes (`Bearer <access_token>`)
* **Path Parameters**: `id` (UUID)
* **Response `204 No Content`**
* **Error `404 Not Found`**:
```json
{
  "detail": "Document not found"
}
```

---

## 3.2 Agent Manager

The Agent Manager handles the lifecycle of agents.

It should support:

```text
Create
Read
Update
Delete
```

An agent configuration can contain:

```text
Agent
├── ID
├── Name
├── Description
├── System Instructions
├── Model
├── Tools
├── Knowledge Sources
└── Configuration
```

Example:

```json
{
    "name": "Maintenance Agent",
    "description": "Industrial maintenance assistant",
    "model": "qwen",
    "instructions": "Help analyze machine maintenance problems.",
    "tools": [
        "document_search",
        "file_reader"
    ]
}
```

---

# 4. Agent Runtime

The Agent Runtime is the most important backend component.

It executes the agent's task.

Basic flow:

```text
User Request
     ↓
Load Agent Configuration
     ↓
Load Model
     ↓
Send Request to LLM
     ↓
LLM decides whether a tool is required
     ↓
Execute Tool
     ↓
Return Tool Result to LLM
     ↓
LLM continues reasoning
     ↓
Final Response
```

The runtime can be implemented as an agent loop:

```text
while task_not_finished:

    send_context_to_model()

    if model_requests_tool:
        execute_tool()
        add_result_to_context()

    else:
        return_final_response()
```

This loop is the core of the **agentic behavior**.

---

# 5. Local/Open-Weight Model Layer

The backend should communicate with a locally running model server.

Possible model runtimes:

```text
Ollama
vLLM
llama.cpp
```

Example:

```text
Agent Runtime
      │
      ▼
Model Interface
      │
      ├── Ollama
      ├── vLLM
      └── llama.cpp
```

The Agent Runtime should not be tightly coupled to one model provider.

This allows different open-weight models to be used later.

---

# 6. Tool System

Agents need tools to perform actions.

Start with a small number of tools.

Example:

```text
Tools
├── File Reader
├── Document Search
├── Python Calculator
└── Internal API
```

The Agent Runtime determines when a tool should be used.

Example:

```text
User:
Analyze the machine report.

Agent
   ↓
Document Search
   ↓
Machine Report
   ↓
LLM Analysis
   ↓
Final Response
```

Tools should be permission-controlled so an agent only receives access to the tools assigned to it.

---

# 7. Knowledge / RAG System

The platform should allow users to upload confidential company documents.

Example:

```text
PDF
DOCX
TXT
CSV
Images
```

Basic pipeline:

```text
Upload Document
      ↓
Extract Content
      ↓
Split into Chunks
      ↓
Create Embeddings
      ↓
Store in Vector Database
      ↓
Agent Search
      ↓
Retrieve Relevant Chunks
      ↓
Send Context to Local LLM
```

Possible local storage:

```text
PostgreSQL
+
pgvector
```

or a dedicated vector database such as Chroma.

The important requirement is that the knowledge base can remain **on-premise**.

---

# 8. Database

Use PostgreSQL for the main application database.

Possible tables:

```text
users
refresh_tokens
agents
running_agents
ai_models
agent_tools
agent_documents
documents
conversations
messages
executions
execution_logs
```

Example:

```text
Agent
│
├── Model
├── Tools
├── Documents
├── Conversations
└── Execution Logs
```

---

# 9. Security

Because this platform is intended for confidential industrial work, security is important.

The backend should provide:

* Authentication
* Authorization
* Agent-level permissions
* Tool permissions
* Document access control
* Audit logs
* Secure file handling

Example:

```text
User
 ↓
Authentication
 ↓
Authorization
 ↓
Agent
 ↓
Allowed Tools
 ↓
Allowed Documents
```

The backend should ensure an agent cannot access data or tools that it has not been given permission to use.

---

# 10. On-Premise Deployment

The backend should be designed so that the entire system can run inside a company's infrastructure.

Example:

```text
              COMPANY NETWORK

┌─────────────────────────────────────┐
│                                     │
│        AI Workbench                 │
│                                     │
│  ┌───────────┐    ┌─────────────┐ │
│  │ Frontend  │───►│ FastAPI     │ │
│  └───────────┘    └──────┬──────┘ │
│                          │        │
│             ┌────────────┼──────┐ │
│             ▼            ▼      ▼ │
│         PostgreSQL     RAG     LLM │
│                              Server│
│                                     │
│          Company Documents          │
│          Company Databases          │
│          Internal APIs              │
│                                     │
└─────────────────────────────────────┘
```

The system can be packaged using Docker for deployment.

---

# 11. Recommended Backend Technology

For the MVP:

```text
Python
│
├── FastAPI
├── Pydantic
├── SQLAlchemy
├── PostgreSQL
├── pgvector / Chroma
├── Ollama
└── PyMuPDF / python-docx
```

Optional later:

```text
Redis
Celery
vLLM
Kubernetes
```

Do not add these until they are actually required.

---

# 12. MVP Backend Priority

Focus on these components first:

```text
1. FastAPI
      ↓
2. Agent CRUD
      ↓
3. Local LLM Connection
      ↓
4. Agent Runtime / Tool Loop
      ↓
5. Basic Tools
      ↓
6. Document Upload
      ↓
7. RAG
      ↓
8. Execution Logging
```

The most important demonstration should be:

```text
Create Agent
      ↓
Select Local Model
      ↓
Give Agent a Tool
      ↓
Upload Company Document
      ↓
Ask Agent a Question
      ↓
Agent searches document
      ↓
Agent uses local LLM
      ↓
Agent produces answer
      ↓
Execution is logged
```

---

# Core Backend Principle

The backend should follow this principle:

> **The LLM provides reasoning, the Agent Runtime controls execution, Tools provide capabilities, RAG provides company knowledge, and the local infrastructure keeps confidential data under the organization's control.**
