# Sovereign On-Premise Agentic AI Workbench

An enterprise-grade, air-gapped agentic AI orchestration platform designed to execute, monitor, and configure autonomous AI agents and direct model chat using local, open-weight GGUF models. Guaranteed **0.0 KB egress** for complete data sovereignty.

---

## 🌟 Core Highlights

* 🤖 **Autonomous Agent Orchestration**: Configure autonomous agents with fine-grained system instructions, deterministic triggers (`manual`, `schedule`, `onetime`), execution timeouts, concurrency limits, and retry policies.
* 💬 **Model Chat & Streaming**: Direct conversational reasoning with local models via Server-Sent Events (SSE) token streaming, multi-turn history, and live tool call cards.
* 🛠️ **19 Autonomous Built-In Tools**: Full suite of OpenAI-compatible function calling tools covering file operations, data parsing (CSV, Excel, JSON, XML, PDF), web querying, API calling, and sandboxed Python code execution.
* 🦙 **Native `llama.cpp` Integration**: Directly runs quantized open-weight `.gguf` models on Windows with CPU (AVX2/AVX512) and GPU offloading (CUDA/Vulkan).
* 📦 **Automatic GGUF Binary Inspection**: Direct browser-to-backend model upload automatically parses metadata (architecture, context length, quantization) directly from the GGUF binary headers using `GGUFReader`.
* ⚡ **Dual Runtime Supervision**: Dedicated `/runtime` console monitoring active agent worker background threads alongside the local `llama-server.exe` daemon status, process PID, and live log stream.
* 📚 **Knowledge Vault (RAG)**: Ingest, chunk, and embed enterprise documentation (`.pdf`, `.docx`, `.txt`) for vector similarity search without third-party cloud APIs.
* 🔐 **Enterprise Security**: Role-based access control, rotating refresh token lifecycle, and local loopback binding (`127.0.0.1`).

---

## 🏗️ Repository Architecture

```text
Agentic-AI-Workbench/
├── .documents/
│   ├── backend.md            # Comprehensive backend architecture, schemas & API reference
│   └── frontend.md           # Frontend architecture, components, workspaces & state guide
├── backend/
│   ├── alembic/              # Database migration revisions
│   ├── app/
│   │   ├── features/         # Modular feature controllers (agents, chat, ai_model, documents, runtime, etc.)
│   │   ├── llm/              # Local llama.cpp client integration via OpenAI Python SDK
│   │   ├── tools/            # 19 autonomous tool handlers with standard OpenAI function schemas
│   │   └── router.py         # Root FastAPI route aggregator
│   ├── database/             # SQLAlchemy ORM models, session factory, seed data
│   ├── build_llama.ps1       # Automated Windows build script for native llama.cpp
│   ├── test_all_tools.py     # End-to-end verification suite for all 19 tools
│   ├── pyproject.toml        # Dependencies & package metadata (uv / pip)
│   └── README.md             # Backend setup & developer guide
├── frontend/
│   ├── app/
│   │   ├── agents/           # Agent fleet overview, builder wizard, and agent console
│   │   ├── chat/             # Direct interactive model chat with streaming & tool inspector
│   │   ├── documents/        # Knowledge Vault document upload and vector indexer
│   │   ├── models/           # Local Model Hub (Downloaded, Upload GGUF, Hugging Face)
│   │   ├── runtime/          # Dedicated Agent & Model Runtime status supervision
│   │   └── settings/         # Enterprise governance, branding, and user directory
│   ├── components/           # Reusable UI component library (sidebar, header, modals, metrics)
│   ├── lib/api/              # Typed Axios API clients with transparent token refresh
│   └── README.md             # Frontend setup & developer guide
└── README.md                 # Project root documentation
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites & Native Compiler Toolchain
* **Python**: `3.12+` with [`uv`](https://docs.astral.sh/uv/) (recommended)
* **Node.js**: `18.18+` or `20+` with `npm`
* **Local Inference Compiler Tools (Windows)**:
  ```powershell
  # Core build toolchain
  winget install --id Git.Git -e
  winget install --id Kitware.CMake -e
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--passive --config --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

  # Hardware acceleration SDK (choose for your GPU)
  winget install --id Nvidia.CUDA -e          # For NVIDIA RTX / GeForce
  winget install --id KhronosGroup.VulkanSDK -e # For Intel Arc/Iris or AMD Radeon
  ```

### 2. Backend Setup & Build Native `llama.cpp`
```bash
cd backend

# Install Python dependencies using uv
uv sync

# Build native llama-server.exe with GPU acceleration (auto-detects CUDA/Vulkan/AVX2)
powershell -ExecutionPolicy Bypass -File build_llama.ps1

# Run database migrations
uv run alembic upgrade head

# Seed default admin user (admin@example.com / Password123!)
uv run python database/seed.py

# (Optional) Seed initial sample GGUF model and knowledge documents
uv run python seed_data.py

# Start FastAPI development server
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Backend Swagger API docs will be available at: `http://localhost:8000/docs`.

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Testing

Verify all 19 built-in autonomous agent tools:
```bash
cd backend
uv run python test_all_tools.py
```

Verify backend test suite:
```bash
cd backend
uv run python -m unittest discover -s tests
```

Verify frontend TypeScript compilation:
```bash
cd frontend
npx tsc --noEmit
```

---

## 📖 In-Depth Documentation

For complete technical specifications, consult the `.documents/` folder:
* 📘 [Backend Technical Reference](.documents/backend.md): Full REST API endpoints, Pydantic schemas, database tables, dual-engine runtime lifecycle, and tool calling definitions.
* 📗 [Frontend Architecture Guide](.documents/frontend.md): Component hierarchy, UI design tokens, client API interceptors, TypeScript types, and workspace workflows.
