# Sovereign On-Premise Agentic AI Workbench — Frontend

Modern, air-gapped web console for orchestrating autonomous AI agents, managing open-weight local GGUF models, conducting direct model chat with streaming and tool execution, and supervising dual background runtimes.

---

## 🚀 Key Workspaces & Features

| Workspace | Route | Description |
| :--- | :--- | :--- |
| **Agents Fleet** | `/agents` | Overview of all configured autonomous agents, active worker heartbeat pulses, assigned models, and schedules. |
| **Agent Builder** | `/agents/new` | Multi-step configuration wizard for system instructions, model selection, execution limits, and triggers (`manual`, `schedule`, `onetime`). |
| **Agent Console** | `/agents/[id]` | Interactive workspace to test, run, view tool execution traces, and inspect live reasoning outputs. |
| **Knowledge Vault** | `/documents` | Ingest enterprise files (`.pdf`, `.docx`, `.txt`) for vector indexing and local Retrieval-Augmented Generation (RAG). |
| **Model Hub** | `/models` | Manage local GGUF models: view downloaded quantizations, drag-and-drop local `.gguf` upload with automatic `GGUFReader` binary metadata extraction, and Hugging Face downloader. |
| **Model Chat** | `/chat` | Direct conversation and prompt engineering with local models, featuring real-time token-by-token SSE streaming, multi-turn history, and visual tool call execution cards. |
| **Runtime** | `/runtime` | Unified supervision center with dedicated tabs for **Agent Runtime Status** (active worker threads, heartbeats, termination) and **Model Runtime Status & Diagnostics** (llama-server daemon, logs stream, latency tests). |
| **Settings** | `/settings` | System-wide parameters, company branding, concurrency limits, API target gateway, and operator user directory. |

---

## 🛠️ Technology Stack

* **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
* **Library**: [React 19](https://react.dev/)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **HTTP Client**: [Axios](https://axios-http.com/) with automatic JWT access token refresh interceptor
* **Theme**: Dark industrial control room aesthetic (Zinc 950 with Cyan, Emerald, and Amber accents)

---

## 🏁 Getting Started

### 1. Prerequisites
* **Node.js**: `18.18+` or `20+`
* **npm**: `9+` (or `pnpm` / `yarn` / `bun`)
* Running backend instance at `http://localhost:8000`

### 2. Navigate to Frontend Directory
```bash
cd frontend
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables (Optional)
Create `.env.local` if your backend is hosted on a custom port or domain:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Build Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts local Next.js dev server with hot module reloading on port 3000 |
| `npx tsc --noEmit` | Runs full TypeScript compiler type check across all components and pages |
| `npm run build` | Builds optimized production bundle |
| `npm run start` | Runs production build server |
| `npm run lint` | Runs Next.js ESLint verification |

---

## 🔒 Air-Gapped Security Guarantee

The frontend is strictly architected for zero-telemetry private cloud and on-premise environments:
* All requests are routed exclusively to the configured local backend gateway (`127.0.0.1` or private subnet).
* No external CDNs, fonts, or tracking scripts are loaded at runtime.
* JWT authentication tokens are kept strictly in local client memory and storage with rotating refresh token safeguards.
