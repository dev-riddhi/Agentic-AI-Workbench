# Frontend Architecture & State Memory — Sovereign Agentic AI Workbench

## 1. System Identity & Mission

* **Platform**: Sovereign On-Premise Agentic AI Workbench — Frontend Console.
* **Core Goal**: Provide enterprise operators, mechanical/industrial engineers, and administrators with a high-fidelity visual console to configure, schedule, monitor, and run autonomous AI agents powered by local GGUF models.
* **Security Imperative**: Strict air-gapped sovereignty with 0.0 KB external telemetry, binding strictly to local loopback (`127.0.0.1`).

---

## 2. Technology Stack & Exact Versions

| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (App Router, Turbopack) | `16.3.4` | Server/Client rendering, routing, page optimization |
| **UI Library** | React / React DOM | `19.2.8` | Component rendering and concurrency |
| **Language** | TypeScript | `^5.0` | Strict type safety across all models and API calls |
| **Styling** | Tailwind CSS | `^4.0` | Utility styling with CSS variables and glassmorphism |
| **Icons** | Lucide React | `^1.40.0` | High-density cyber-industrial icon set |
| **Motion Engine** | Framer Motion | `^13.2.0` | Physics-based spring animations, layout transitions |
| **HTTP Client** | Axios | `^1.20.0` | Strongly typed API client with request/response interceptors |
| **Theme Engine** | next-themes | `^0.4.6` | Dark mode / Industrial theme persistence |

---

## 3. Architectural Decisions Record (ADR)

### ADR-01: Zero External Telemetry & Local Asset Bundling
* **Context**: Industrial installations require strict zero-data-egress compliance.
* **Decision**: No external CDNs, tracking scripts, or remote font CDNs are allowed. All fonts are self-hosted via `next/font`, and all icons are bundled locally via `lucide-react`.

### ADR-02: Single-Use Rotating Refresh Token Interceptor
* **Context**: Access tokens expire after 30 minutes. User workflows must not be abruptly interrupted by token expiration.
* **Decision**: The Axios client ([frontend/lib/api/client.ts](file:///e:/Agentic-AI-Workbench/frontend/lib/api/client.ts)) intercepts `401 Unauthorized` responses, queues pending requests, calls `POST /api/v1/users/refresh` using the stored refresh token, updates both tokens, and seamlessly replays the queued requests. If refresh fails, it redirects to `/login`.

### ADR-03: Dual-Engine Runtime Supervision
* **Context**: The backend maintains two separate processes: the `llama-server.exe` GGUF inference daemon and the background autonomous agent scheduler/worker threads.
* **Decision**: The frontend provides a dedicated `/runtime` dashboard displaying both engines side-by-side, offering independent controls (start/stop model server, terminate worker thread, view live stdout ring buffer).

### ADR-04: Aesthetic Paradigm — Dark Neo-Brutalism Meets Cyber Glassmorphism
* **Context**: Standard enterprise dashboard templates feel generic and lack visual impact.
* **Decision**: Adopt sharp, 1px high-contrast structural borders, monospaced tabular readouts, and deep Zinc backgrounds fused with frosted `backdrop-blur-md` surfaces and electric cyan/emerald glowing indicators.

---

## 4. Route & File Inventory

```text
frontend/
├── app/
│   ├── layout.tsx              # Root HTML shell with Providers & NavigationShell
│   ├── page.tsx                # Auth gateway redirecting to /agents or /auth/login
│   ├── providers.tsx           # Query, Theme & Global providers
│   ├── globals.css             # Tailwind 4 theme, scrollbars, and glass utilities
│   ├── not-found.tsx           # Cosmic 404 Error Page (floating astronaut reading)
│   ├── auth/login/page.tsx     # Operator authentication form
│   ├── login/page.tsx          # Backward-compatibility login redirect
│   ├── agents/
│   │   ├── page.tsx            # Agents Fleet Dashboard (cards, filters, search)
│   │   ├── new/page.tsx        # Multi-step Agent Builder & Scheduler Wizard
│   │   └── [id]/page.tsx       # Agent Mission Console & Live Reasoning Feed
│   ├── chat/page.tsx           # Direct LLM Chat Studio
│   ├── documents/page.tsx      # Knowledge Vault RAG Ingestion & Document Table
│   ├── models/page.tsx         # GGUF Model Hub (Catalog, Upload, HF Downloader)
│   ├── runtime/page.tsx        # Dual-Engine Supervisor (Workers + llama-server)
│   ├── operations/page.tsx     # Backward-compatibility redirect to /runtime
│   └── settings/page.tsx       # Governance, limits, custom JSON, user management
├── components/
│   ├── ui/                     # Cyber-Industrial atomic primitives
│   │   ├── button.tsx          # Tactile buttons (primary, secondary, danger, pill, ghost)
│   │   ├── badge.tsx           # Telemetry & status badges (active pulse, scheduled, model)
│   │   ├── modal.tsx           # Framer Motion spring modals & ConfirmModal
│   │   ├── skeleton.tsx        # Dimension-matched shimmer loaders (zero CLS)
│   │   └── index.ts            # Central exports
│   ├── layout/
│   │   ├── header.tsx          # Breadcrumbs, active worker pulse, profile menu
│   │   ├── sidebar.tsx         # Navigation links + persistent 0.0 KB egress pill
│   │   └── navigation-shell.tsx# Dynamic shell wrapping authenticated routes
│   └── theme-toggle.tsx        # Hydration-safe theme switcher (Light/Dark/System)
├── context/
│   ├── auth-context.tsx        # Session state, login/logout, current user
│   └── toast-context.tsx       # Toast notifications & confirmation dialogs
├── lib/
│   ├── api/                    # API client layer with JWT interceptors
│   │   ├── client.ts           # Configured Axios client with JWT rotation interceptor
│   │   ├── types.ts            # TypeScript schemas matching backend Pydantic models
│   │   ├── agents.ts           # Agent CRUD, run, stop, running list
│   │   ├── models.ts           # GGUF models, upload, HF download, llama status
│   │   ├── documents.ts        # Knowledge upload, download, list, delete
│   │   ├── runtime.ts          # System overview, worker list, start/stop model
│   │   ├── settings.ts         # Platform settings & custom JSON attributes
│   │   ├── users.ts            # Operator provisioning and user list
│   │   └── auth.ts             # Login, refresh, me, logout endpoints
│   └── constants/              # System constants and dictionary mappings
│       └── tools.ts            # 19 deterministic tools catalog, categories & prompts
└── docs/
    ├── pages.md                # Page & route specifications
    ├── design.md               # Visual aesthetics & design tokens
    ├── phases.md               # Chronological implementation plan
    ├── pases.md                # Compatibility alias
    ├── memory.md               # Architectural memory & ADRs (this file)
    └── rules.md                # Code writing standards & verification system
```

---

## 5. API Endpoints & Contracts

All requests route to `http://localhost:8000/api/v1`:

* **Auth**:
  * `POST /users/login` -> `{ access_token, refresh_token, token_type, expires_in }`
  * `POST /users/refresh` -> `{ access_token, refresh_token, token_type, expires_in }`
  * `GET /users/me` -> `{ id, name, email, created_at }`
* **Agents**:
  * `GET /agents/` -> `Agent[]`
  * `POST /agents/` -> `Agent`
  * `GET /agents/{id}` -> `Agent` (with populated `ai_model`, `tools`, `documents`)
  * `PUT /agents/{id}` -> `Agent`
  * `DELETE /agents/{id}` -> `204 No Content`
  * `POST /agents/{id}/run` -> `{ execution_id, agent_id, status, response, tool_calls }`
  * `POST /agents/{id}/stop` -> `{ execution_id, agent_id, status, message }`
  * `GET /agents/running` -> `Agent[]` (currently running workers)
* **Models**:
  * `GET /models/` -> `AIModel[]`
  * `POST /models/upload` -> `AIModel` (multipart/form-data)
  * `POST /models/download` -> `AIModel` (background Hugging Face fetch)
  * `DELETE /models/{id}` -> `204 No Content`
* **Runtime**:
  * `GET /runtime/overview` -> `{ llama_installed, model_runtime, active_agents_count, active_agents }`
  * `POST /runtime/models/start` -> `ModelRuntimeStatus`
  * `POST /runtime/models/stop` -> `ModelRuntimeStatus`
  * `GET /runtime/models/logs` -> `{ logs: string[] }`
  * `POST /runtime/models/test` -> `{ success, response, latency_ms, usage }`
  * `POST /runtime/agents/{id}/stop` -> `{ status: "stopped" }`
* **Documents**:
  * `GET /documents/` -> `Document[]`
  * `POST /documents/` -> `Document` (multipart/form-data)
  * `GET /documents/{id}/download` -> binary stream
  * `DELETE /documents/{id}` -> `204 No Content`
* **Settings**:
  * `GET /settings/` -> `{ id, key, data: SettingsData }`
  * `PUT /settings/` -> `{ id, key, data: SettingsData }`

---

## 6. Known Quirks & Implementation Notes

1. **Hydration Mismatches**: Use the `useSyncExternalStore` pattern (as seen in `theme-toggle.tsx`) when reading `localStorage` or `window` state to prevent SSR hydration warnings in Next.js 16.
2. **Next.js 16 Turbopack**: All styling uses Tailwind CSS v4. Ensure classes adhere to standard tokens (e.g. `w-28` instead of arbitrary `w-[112px]`).
3. **Axios Interceptor Loop Guard**: The response interceptor explicitly ignores requests targeting `/users/login` and `/users/refresh` to prevent infinite loops when tokens are revoked.
4. **Air-Gap Verification**: The persistent sidebar status badge verifies `127.0.0.1` loopback binding and confirms 0.0 KB external telemetry to reassure enterprise operators.
5. **React 19 Hook Linter Rules**: Strictly avoid calling `setState` synchronously within `useEffect` hooks on mount; use lazy state initialization or resolve async promises inside effects to comply with React 19 concurrent safety.

---

## 7. Multi-Verification System (MVS) Audit Results

| Verification Check | Target Standard | Actual Result | Status |
|---|---|---|---|
| **TypeScript Compilation** (`tsc --noEmit`) | 0 type errors | **0 errors** across entire codebase | **PASSED** |
| **ESLint Hygiene** (`eslint app components lib`) | 0 warnings, 0 errors | **0 errors, 0 warnings** | **PASSED** |
| **Tool Integration Coverage** | 19 deterministic backend tools | **19 tools mapped & categorized** in `tools.ts` | **PASSED** |
| **Air-Gap Telemetry Compliance** | 0.0 KB external egress | **0 external CDNs / 127.0.0.1 loopback** | **PASSED** |
| **Live Browser Subagent Verification** | All pages loaded & interactive | **All 7 major routes live tested** | **PASSED** |
| **Next.js Dev Server** | 200 OK across routes | **Active on port 3000** | **HEALTHY** |
| **FastAPI Backend Server** | 200 OK across endpoints | **Active on port 8000** | **HEALTHY** |

