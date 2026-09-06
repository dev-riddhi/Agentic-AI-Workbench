# Frontend Pages Specification — Sovereign Agentic AI Workbench

This document provides a comprehensive specification of every page, route, view state, interactive component, and data contract across the frontend application.

---

## 1. Route Map Overview

| Route | Page File | Access Level | Description |
|---|---|---|---|
| `/` | `app/page.tsx` | Public / Gateway | Auth gateway: redirects authenticated operators to `/agents`, else renders `/auth/login`. |
| `/auth/login` | `app/auth/login/page.tsx` | Public | Operator sign-in with air-gapped credentials, remember session, and error handling. |
| `/login` | `app/login/page.tsx` | Public | Alias / redirect to `/auth/login` for backward compatibility. |
| `/agents` | `app/agents/page.tsx` | Protected | Fleet overview: searchable agent cards, real-time worker pulse, trigger chips, and quick actions. |
| `/agents/new` | `app/agents/new/page.tsx` | Protected | Multi-step Agent Builder & Scheduler wizard (General, Model, Triggers, Tools, RAG, Limits). |
| `/agents/[id]` | `app/agents/[id]/page.tsx` | Protected | Mission Execution Console: interactive run/stop, tool call timeline, reasoning tree, inline config. |
| `/chat` | `app/chat/page.tsx` | Protected | Direct LLM Interaction Studio: conversation threads, model selection, reasoning parameters. |
| `/documents` | `app/documents/page.tsx` | Protected | Knowledge Vault: drag-and-drop RAG document ingestion, indexing status, file table, preview/download. |
| `/models` | `app/models/page.tsx` | Protected | GGUF Model Hub: downloaded models catalog, drag-and-drop local `.gguf` uploader, HF downloader. |
| `/runtime` | `app/runtime/page.tsx` | Protected | Dual-Engine Diagnostics: Model server supervisor (`llama-server`) and Agent worker supervisor. |
| `/operations` | `app/operations/page.tsx` | Protected | Backwards-compatibility redirect to `/runtime`. |
| `/settings` | `app/settings/page.tsx` | Protected | Enterprise Governance: branding, concurrency limits, air-gap status, custom JSON, user provisioning. |

---

## 2. Page Specifications

### 2.1 Authentication Gateway (`/auth/login`)
* **Purpose**: Secure operator sign-in on air-gapped internal network with zero external OAuth/cloud telemetry.
* **Layout**: Centered cyber-industrial glass card over a dark radial mesh with animated subtle grid background.
* **Key Components**:
  * **Header**: Workbench Logo with neon emerald pulse, "SOVEREIGN AGENTIC WORKBENCH" title, "AIR-GAPPED SYSTEM // LOCAL LOOPBACK ONLY" badge.
  * **Form Inputs**: Email input (with `@` icon), Password input (with toggleable show/hide eye icon).
  * **Actions**: "Authenticate Operator" primary neo-brutalist button with loading spinner state.
  * **Diagnostics Footer**: Shows `API: 127.0.0.1:8000/api/v1` and `Egress: 0.0 KB (Verified)`.
* **State Machine**:
  * *Idle*: Ready for operator input.
  * *Submitting*: Button disabled, spinner active, inputs read-only.
  * *Error*: Shake animation on card, red alert banner showing exact backend error detail (`Invalid credentials`, `Connection refused`).
  * *Success*: Emerald checkmark flash, redirects to `/agents`.
* **Backend API**: `POST /api/v1/users/login` -> stores `access_token` and `refresh_token` in `localStorage`.

---

### 2.2 Agents Workspace (`/agents`)
* **Purpose**: Central operational dashboard displaying the fleet of configured AI agents in the organization.
* **Layout**: Sticky top action header + searchable filter bar + multi-column responsive grid of glassmorphic agent cards.
* **Key Components**:
  * **Action Header**: Page title with active agent counter badge, "Create Agent" primary CTA button with plus icon.
  * **Filter Bar**: Search input (filters by name, description, model, tool name), trigger filter dropdown (All, Manual, Schedule, One-Time).
  * **Agent Card**:
    * **Header**: Agent avatar with model badge, active execution green pulse ring (if `is_running: true`), agent name.
    * **Description**: Multi-line truncated description.
    * **Trigger Chip**: Visual badge (`⚡ Manual`, `🕒 Every 1 day at 09:00`, `📅 2026-09-10`).
    * **Attached Capabilities**: Tool tags (`Database`, `Documents`, `Email`) with tooltip handlers.
    * **Knowledge Badge**: Document count chip (`📁 2 Documents attached`).
    * **Action Footer**: "Open Console" primary link, "Edit" button, "Decommission" danger button with confirmation modal.
  * **Empty State**: Neo-brutalist container with dashed border, Bot icon, "No Agents Configured", and direct "Create Your First Agent" CTA.
* **Backend API**:
  * `GET /api/v1/agents/` (List all agents)
  * `GET /api/v1/agents/running` (Poll active worker threads)
  * `DELETE /api/v1/agents/{id}` (Decommission agent)

---

### 2.3 Agent Builder & Scheduler (`/agents/new`)
* **Purpose**: Multi-section, highly deterministic wizard for configuring production-ready autonomous agents.
* **Layout**: 2-column layout: Left column contains the multi-step form sections; Right column provides a live "Agent Blueprint Preview" card that updates in real-time.
* **Sections**:
  1. **General Information**: Agent Name, Operational Description, System Instructions / Prompt (with expandable code-editor-style textarea).
  2. **Model Selection**: Dropdown populated from downloaded GGUF models (`GET /api/v1/models/`), displaying model name, quantization (`Q4_K_M`), and file size.
  3. **Trigger & Scheduling**:
     - Mode Selector: Radio cards for `Manual`, `Schedule`, and `One-Time`.
     - Schedule Builder: Interval number + Interval unit (`Minutes`, `Hours`, `Days`, `Weeks`) + Execution Time picker (`HH:MM`).
     - One-Time: ISO datetime picker.
  4. **Tool Capabilities**: Interactive checkbox grid for all 19 tools (File I/O, Search, Web, API, Python sandbox), grouped by category with permission tooltips.
  5. **Knowledge Vault Attachment**: Multi-select checklist of indexed documents with file size and type badges.
  6. **Advanced Controls**: Max execution time (minutes), Max tool calls per run, Concurrency limit, Auto-retry count.
* **Actions**: "Cancel" button (returns to `/agents`), "Deploy Agent" high-contrast button.
* **Backend API**: `POST /api/v1/agents/`

---

### 2.4 Agent Mission Console (`/agents/[id]`)
* **Purpose**: Real-time supervision, interactive prompt triggering, and deep reasoning inspection for a specific agent.
* **Layout**: 3-panel split view:
  * **Top Bar**: Agent identity, model chip, trigger status, "Run Task" emerald CTA, "Stop Task" crimson button.
  * **Left Panel / Tab 1 (Reasoning & Execution Log)**:
    * Interactive task input with multi-line textarea and shortcut hint (`Ctrl + Enter` to trigger).
    * Execution history thread: User task prompts, Agent response formatted with streaming markdown syntax highlighting.
    * Tool Call Accordion: Collapsible cards showing tool name, timestamp, arguments JSON, and execution return result.
  * **Right Panel / Tab 2 (Agent Configuration & Documents)**:
    * Inline editor to update system instructions, schedule, attached tools, or document bindings without navigating away.
* **Backend API**:
  * `GET /api/v1/agents/{id}`
  * `POST /api/v1/agents/{id}/run`
  * `POST /api/v1/agents/{id}/stop`
  * `PUT /api/v1/agents/{id}`

---

### 2.5 Knowledge Vault (`/documents`)
* **Purpose**: Ingestion, status monitoring, and retrieval management of enterprise files for local RAG.
* **Layout**: Drag-and-drop dropzone on top + tabular directory with search and filtering below.
* **Key Components**:
  * **Ingestion Zone**: Drag-and-drop zone with animated neon dashed border, supporting `.pdf`, `.docx`, `.txt`, `.csv`, `.xlsx`. Real-time upload progress bar.
  * **Metrics Bar**: Total documents indexed, storage consumption on local disk, average chunking count.
  * **Documents Table**: Filename, MIME icon (PDF, DOCX, etc.), file size in KB/MB, indexing status (`indexed` in emerald, `processing` in amber, `failed` in rose), upload timestamp, Download binary button, Delete button with confirmation.
* **Backend API**:
  * `GET /api/v1/documents/`
  * `POST /api/v1/documents/` (multipart/form-data)
  * `GET /api/v1/documents/{id}/download`
  * `DELETE /api/v1/documents/{id}`

---

### 2.6 GGUF Model Hub (`/models`)
* **Purpose**: Complete control center for open-weight `.gguf` models running with native `llama.cpp`.
* **Layout**: Tabbed interface:
  * **Tab 1: Downloaded GGUF Models**: Cards displaying local models with model architecture badge, quantization format (`Q4_K_M`, `Q8_0`), file size on disk, status (`ready`), and Delete action. Top banner with direct link to "Inspect Model Runtime".
  * **Tab 2: Upload Local Model**: Drag-and-drop `.gguf` multipart uploader. Automatically parses internal metadata via backend `GGUFReader` (no manual typing required).
  * **Tab 3: Hugging Face Downloader**: Form to input Repo ID (e.g. `TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF`) and filename (`tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf`). Initiates background download thread with real-time poll.
* **Backend API**:
  * `GET /api/v1/models/`
  * `POST /api/v1/models/upload`
  * `POST /api/v1/models/download`
  * `DELETE /api/v1/models/{id}`

---

### 2.7 Dual-Engine Runtime & Diagnostics (`/runtime`)
* **Purpose**: Unified mission-critical supervisory console dedicated exclusively to monitoring and controlling the two core engines:
  1. **Agent Runtime Engine**: Active background worker threads.
  2. **Model Runtime Engine**: Local `llama-server.exe` process.
* **Layout**: Two primary supervision tabs:
  * **Tab 1: Agent Runtime Supervisor**:
    * Active Agent Worker Registry: Live table of executing worker threads from `runtime` table (`Agent Name`, `Model`, `Worker Thread ID`, `Started At`, `Last Heartbeat`).
    * One-click "Terminate Worker" safety button.
    * Air-gap telemetry counter: `Loopback: 127.0.0.1`, `Egress: 0.0 KB`.
  * **Tab 2: Model Runtime Supervisor**:
    * Live Status Card: Online / Offline status badge, Process PID, Port (`8080`), Uptime, Binary executable path.
    * Runner Configuration: Model selector, Port, Context Size (`4096`), GPU Layers (`99`), Threads (`8`).
    * Server Controls: "Start Model Server", "Stop Model Server".
    * Live Terminal Logs: Streaming 500-line stdout/stderr log buffer from `llama-server.exe` with auto-scroll and manual refresh.
    * Diagnostic Inference Benchmark: Interactive test box returning full response, prompt/completion tokens, and roundtrip latency in milliseconds.
* **Backend API**:
  * `GET /api/v1/runtime/overview`
  * `GET /api/v1/runtime/models/status`
  * `POST /api/v1/runtime/models/start`
  * `POST /api/v1/runtime/models/stop`
  * `GET /api/v1/runtime/models/logs`
  * `POST /api/v1/runtime/models/test`
  * `GET /api/v1/runtime/agents`
  * `POST /api/v1/runtime/agents/{id}/stop`

---

### 2.8 Direct Chat Studio (`/chat`)
* **Purpose**: Interactive, low-latency playground to converse directly with any loaded GGUF model without configuring a full agent.
* **Layout**: Sidebar with conversation thread history + main chat stream + right-hand parameter drawer (Temperature, Top-P, Max Tokens, System Prompt).
* **Key Components**:
  * Multi-session sidebar (New Chat, session rename, delete).
  * Markdown chat bubbles with syntax-highlighted code blocks and single-click copy buttons.
  * Token usage and latency badge per response.
* **Backend API**: `POST /api/v1/chat/`

---

### 2.9 Settings & Enterprise Governance (`/settings`)
* **Purpose**: Platform branding, concurrency limits, system parameters, custom JSON metadata, and user administration.
* **Sections**:
  1. **Operational Limits**: Max concurrent worker limit (e.g. 10), default tool execution timeout (seconds), maintenance mode toggle.
  2. **Platform Branding**: Company name, environment badge (`development`, `staging`, `production`), API Gateway Base URL.
  3. **Custom Attributes (JSON/JSONB)**: Key-value manager to store arbitrary organizational metadata in the `settings` database table.
  4. **User & Operator Management**: Table of registered system operators, plus a form to provision new operators (Name, Email, Password).
* **Backend API**:
  * `GET /api/v1/settings/`
  * `PUT /api/v1/settings/`
  * `GET /api/v1/users/`
  * `POST /api/v1/users/`
