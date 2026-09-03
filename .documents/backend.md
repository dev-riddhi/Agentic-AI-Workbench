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

Example:

```text
POST /agents
GET /agents
GET /agents/{id}
PUT /agents/{id}
DELETE /agents/{id}

GET /models

POST /documents

POST /agents/{id}/run
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
agents
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
