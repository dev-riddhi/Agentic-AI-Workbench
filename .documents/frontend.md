# Sovereign On-Premise Agentic AI Workbench — Frontend

## 1. Main Goal

The frontend provides a simple interface for users to:

* Create AI agents
* Configure AI agents
* Select a local/open-weight AI model
* Give agents tools
* Upload knowledge/documents
* Run and chat with agents
* Manage existing agents

The frontend should focus on **simplicity and usability**, not on building a large number of advanced features.

---

## 2. Frontend Architecture

```text
                    FRONTEND
                       │
                       ▼
              ┌─────────────────┐
              │   Web Interface │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Agent UI      Model UI     Settings
          │
          ▼
    Agent Workspace
          │
    ┌─────┼─────────────┐
    ▼     ▼             ▼
 Configure Tools      Knowledge
 Agent                /Documents
          │
          ▼
       Chat / Run
          │
          ▼
      Backend API
```

---

## 3. Main Screens

### 3.1 Agent List

The main screen displays all available agents.

Users should be able to:

* View agents
* Open an agent
* Edit an agent
* Delete an agent
* Create a new agent

Example:

```text
AI Workbench

My Agents

┌─────────────────────────────────┐
│ Maintenance Agent               │
│ Machine maintenance assistant   │
│ Model: Qwen                     │
│                                 │
│ [Open] [Edit] [Delete]          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Document Assistant              │
│ Company document assistant      │
│ Model: Llama                    │
│                                 │
│ [Open] [Edit] [Delete]          │
└─────────────────────────────────┘

             [+ Create Agent]
```

---

### 3.2 Create Agent

This is one of the most important screens.

The user should be able to configure:

* Agent name
* Description
* System instructions
* AI model
* Tools
* Knowledge/documents

Example:

```text
Create Agent

Name
[ Maintenance Agent ]

Description
[ Machine maintenance assistant ]

Instructions
[ You are an industrial maintenance assistant... ]

Model
[ Qwen ▼ ]

Tools

☑ Document Search
☑ File Reader
☐ Python
☐ Internal API

Knowledge

[ + Upload Documents ]

              [Create Agent]
```

---

### 3.3 Agent Workspace

The workspace allows the user to interact with an agent.

```text
┌─────────────────────────────────────────────┐
│ Maintenance Agent                           │
│ Model: Qwen                                 │
├─────────────────────────────────────────────┤
│                                             │
│ User                                        │
│ Analyze this machine report.                │
│                                             │
│ Agent                                       │
│ I found three potential issues...           │
│                                             │
│ ✓ Document Search                           │
│ ✓ Maintenance Manual                        │
│                                             │
├─────────────────────────────────────────────┤
│ Ask the agent...                    [Send]  │
└─────────────────────────────────────────────┘
```

The workspace should also show the agent's current activity.

```text
Agent is working...

✓ Reading document
✓ Searching knowledge
● Analyzing data
○ Generating response
```

This helps demonstrate that the system is actually **agentic** rather than simply a chatbot.

---

### 3.4 Agent Configuration

Users should be able to modify an existing agent.

```text
Agent Settings

General
    Name
    Description
    Instructions

Model
    Local Model

Tools
    Available Tools

Knowledge
    Uploaded Documents

              [Save Changes]
```

---

### 3.5 Model Screen

Display the models available in the local environment.

```text
Local Models

┌─────────────────────────────────┐
│ Qwen                            │
│ Multimodal Model                │
│ Status: ● Available             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Llama                           │
│ Text Model                      │
│ Status: ● Available             │
└─────────────────────────────────┘
```

The frontend does not run the model itself. It requests model information from the backend.

---

## 4. Frontend → Backend Communication

The frontend communicates with the backend through APIs.

```text
Frontend
    │
    │ HTTP / HTTPs
    ▼
FastAPI Backend
```

### 4.1 Authentication & Token Lifecycle

* **Base URL**: `http://localhost:8000/api/v1`
* **Access Token**: Short-lived JWT (30 mins). Pass in all protected requests as `Authorization: Bearer <access_token>`.
* **Refresh Token**: Long-lived single-use token (7 days). Stored to obtain new access tokens via `POST /api/v1/users/refresh`.
* **Token Rotation**: Each call to `/api/v1/users/refresh` invalidates the previous refresh token and returns a new one.
* **Interceptor Pattern**:
  1. Frontend HTTP client (e.g. Axios/Fetch wrapper) attaches `Authorization: Bearer <access_token>`.
  2. If backend responds with `401 Unauthorized`, client attempts `POST /api/v1/users/refresh` with `refresh_token`.
  3. If refresh succeeds, retry the failed request with the new access token.
  4. If refresh fails, clear tokens and redirect to `/login`.

---

### 4.2 Authentication & User Endpoints

#### 1. Login (`POST /api/v1/users/login`)
* **Request JSON**:
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
* **Response `401 Unauthorized`**:
```json
{
  "detail": "Invalid email or password"
}
```

---

#### 2. Refresh Token (`POST /api/v1/users/refresh`)
* **Request JSON**:
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

---

#### 3. Logout (`POST /api/v1/users/logout`)
* **Request JSON**:
```json
{
  "refresh_token": "9xLpAQhF2s7bT5vK-1mR..."
}
```
* **Response `204 No Content`**

---

#### 4. Get Current User (`GET /api/v1/users/me`)
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

---

#### 5. Register User (`POST /api/v1/users/`)
* **Request JSON**:
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

---

### 4.3 Agent Management Endpoints

#### 1. Get Agent List (`GET /api/v1/agents/`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Query Parameters**: `skip=0`, `limit=100`
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

#### 2. Create Agent (`POST /api/v1/agents/`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Request JSON**:
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

#### 3. Get Agent Details (`GET /api/v1/agents/{id}`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Response `200 OK`**: Returns single agent object with `model_id` and nested `ai_model` details.

---

#### 4. Update Agent (`PUT /api/v1/agents/{id}` or `PATCH /api/v1/agents/{id}`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Request JSON**:
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
* **Response `200 OK`**:
```json
{
  "id": "8c59f0f6-d703-4b68-b808-fa2fa1a6a2ef",
  "owner_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Maintenance Agent v2",
  "description": "Updated maintenance assistant",
  "instructions": "Diagnose machine anomalies and suggest repair procedures.",
  "model": "llama",
  "created_at": "2026-09-03T14:30:00Z",
  "updated_at": "2026-09-03T14:40:00Z",
  "tools": [
    {
      "id": "7b59f0f6-d703-4b68-b808-fa2fa1a6a2aa",
      "name": "document_search",
      "description": "Tool for document_search",
      "handler": "default_document_search"
    }
  ],
  "documents": [],
  "updated_at": "2026-09-03T14:40:00Z"
}
```

---

#### 5. Delete Agent (`DELETE /api/v1/agents/{id}`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Response `204 No Content`**

---

#### 6. Run Agent Chat / Execution (`POST /api/v1/agents/{id}/run`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Request JSON**:
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

---

#### 7. Stop Agent Execution (`POST /api/v1/agents/{id}/stop`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Request JSON** *(Optional)*:
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

---

#### 8. List Running Agents (`GET /api/v1/agents/running`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Query Parameters**: `auto_restart_only=false`
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

#### 9. Get Agent Documents (`GET /api/v1/agents/{id}/documents`)
* **Headers**: `Authorization: Bearer <access_token>`
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

---

### 4.4 Models & Knowledge Endpoints

#### 1. Download GGUF Model from Hugging Face (`POST /api/v1/models/download`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Query Parameters**: `background=true` (optional)
* **Constraints**: **Only `.gguf` model files are supported**. Any other extension results in `422/400 Bad Request`.
* **Request JSON**:
```json
{
  "repo_id": "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
  "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
  "name": "TinyLlama 1.1B Chat (Q4_K_M)",
  "quantization": "Q4_K_M"
}
```
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

---

#### 2. List Downloaded Models (`GET /api/v1/models/`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Query Parameters**: `skip=0`, `limit=100`
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

#### 3. Get Model Details (`GET /api/v1/models/{id}`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Path Parameters**: `id` (UUID)
* **Response `200 OK`**: Single model object

---

#### 4. Delete Model (`DELETE /api/v1/models/{id}`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Path Parameters**: `id` (UUID)
* **Response `204 No Content`**

---

#### 2. Upload Document (`POST /api/v1/documents/`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Content-Type**: `multipart/form-data`
* **Form Field**: `file` (binary PDF, DOCX, TXT)
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

#### 3. List Documents (`GET /api/v1/documents/`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Query Parameters**: `skip=0`, `limit=100`
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

#### 4. Get Document Details (`GET /api/v1/documents/{id}`)
* **Headers**: `Authorization: Bearer <access_token>`
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

---

#### 5. Download Document (`GET /api/v1/documents/{id}/download`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Path Parameters**: `id` (UUID)
* **Response `200 OK`**: Raw binary file download

---

#### 6. Delete Document (`DELETE /api/v1/documents/{id}`)
* **Headers**: `Authorization: Bearer <access_token>`
* **Path Parameters**: `id` (UUID)
* **Response `204 No Content`**

---

#### 7. Get Documents for Agent (`GET /api/v1/agents/{id}/documents`)
* **Headers**: `Authorization: Bearer <access_token>`
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

---

### 4.5 Real-Time Execution Streaming (Future Extension)

For agent execution, WebSocket or Server-Sent Events (SSE) can later be used to stream:

```text
Thinking
Tool execution
Tool result
Final response
```

---

## 5. Recommended Frontend Technology

For the MVP:

```text
Frontend
│
├── React
├── TypeScript
├── Vite / Next.js
└── Tailwind CSS
```

The frontend should remain independent from the AI model.

Its responsibility is primarily:

```text
User Interface
      ↓
Agent Configuration
      ↓
API Requests
      ↓
Display Results
```

---

## 6. MVP Priority

Focus on these features first:

1. Agent List
2. Create Agent
3. Configure Agent
4. Select Local Model
5. Upload Documents
6. Agent Chat / Execution
7. Agent Edit/Delete

Avoid implementing advanced dashboards, marketplaces, complex workflow builders, and large numbers of integrations until the core workflow works.

---

# Core Frontend Workflow

```text
Create Agent
      ↓
Configure Agent
      ↓
Select Local Model
      ↓
Add Tools
      ↓
Upload Knowledge
      ↓
Save Agent
      ↓
Run Agent
      ↓
View Execution
      ↓
Receive Result
```
