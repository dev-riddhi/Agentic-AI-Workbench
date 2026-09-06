# Agentic AI Workbench - Backend

FastAPI backend providing autonomous agent orchestration, local GGUF model management via Hugging Face and binary upload, 19 autonomous function-calling tools, direct model chat with SSE streaming, native `llama.cpp` runtime supervision, RAG document knowledge base, token-based authentication with refresh rotation, and system recovery.

---

## 🛠️ Prerequisites & System Requirements

Before running the backend, ensure your environment meets the following requirements:

### 1. Python Environment
* **Python**: `3.12+`
* **Package Manager**: [`uv`](https://docs.astral.sh/uv/) *(strongly recommended)* or standard `pip`

### 2. `llama.cpp` Native Compilation Prerequisites (Windows)
To execute local `.gguf` open-weight models on-premise without cloud latency or egress, the backend integrates with native `llama.cpp` (`llama-server.exe`). The build script can automatically check or install these via `winget`, or you can install them manually:

* **Git Version Control**:
  ```powershell
  winget install --id Git.Git -e
  ```
* **CMake Build System** (v3.20+):
  ```powershell
  winget install --id Kitware.CMake -e
  ```
* **Visual Studio 2022 C++ Build Tools** (MSVC compiler `cl.exe`):
  ```powershell
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--passive --config --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  ```
* **Hardware Acceleration SDK (Choose based on your GPU):**
  * **NVIDIA GPU (CUDA)**:
    ```powershell
    winget install --id Nvidia.CUDA -e
    ```
  * **Intel Arc / UHD / Iris or AMD Radeon (Vulkan)**:
    ```powershell
    winget install --id KhronosGroup.VulkanSDK -e
    ```
  * **CPU Fallback**: No additional SDK needed. The build script automatically enables optimized **AVX2** instructions.

---

## 🚀 Quickstart Guide

### 1. Navigate to the Backend Directory
```bash
cd backend
```

### 2. Install Python Dependencies
Using `uv` (recommended):
```bash
uv sync
```

*(Or using standard virtualenv and pip)*:
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate
pip install -e .
```

---

### 3. Build Native `llama.cpp` Binaries (`build_llama.ps1`)

Run the automated build script to compile `llama.cpp` for native local inference:

```powershell
powershell -ExecutionPolicy Bypass -File build_llama.ps1
```

#### What `build_llama.ps1` Does:
1. **Prerequisite Check**: Validates and installs missing build tools (Git, CMake, MSVC, Vulkan/CUDA SDK) via `winget`.
2. **Repository Sync**: Clones or pulls the latest `llama.cpp` source into `backend/llama.cpp`.
3. **Hardware Detection**: Auto-detects installed GPUs (NVIDIA RTX, Intel Iris/Arc, AMD Radeon) and configures CMake for the optimal backend (`CUDA`, `Vulkan`, or optimized `CPU AVX2`).
4. **Optimized Compilation**: Compiles the Release binaries including `llama-server.exe` and `llama-cli.exe` using available CPU threads.
5. **Disk Footprint Cleanup**: Removes intermediate source files, retaining **ONLY** the compiled `build` directory and creating a junction link `llama.cpp/bin -> llama.cpp/build/bin`.

#### Script Options:
```powershell
# Force re-compilation from scratch
.\build_llama.ps1 -ForceRebuild

# Target specific acceleration backend (auto, cuda, vulkan, cpu)
.\build_llama.ps1 -DeviceBackend vulkan

# Skip automatic winget prerequisite installation
.\build_llama.ps1 -SkipPrereqs

# Pass custom CMake flags
.\build_llama.ps1 -CustomCmakeFlags "-DGGML_AVX512=ON"
```

---

### 4. Run Database Migrations
Initialize and update SQLite database (`database/app.db`) to the latest revision:
```bash
uv run alembic upgrade head
```

---

### 5. Seed the Database

#### A. Seed Default Admin User:
```bash
uv run python database/seed.py
```
* **Default Email**: `admin@example.com`
* **Default Password**: `Password123!`

#### B. (Optional) Seed Starter Models & Knowledge Documents:
Populate the database with sample model entries and documents:
```bash
uv run python seed_data.py
```

---

### 6. Start the Backend Server
Start the development server with auto-reload:
```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Once running, the backend is accessible at:
* **Root Healthcheck**: `http://localhost:8000/`
* **API v1 Base URL**: `http://localhost:8000/api/v1`
* **Interactive Swagger UI**: `http://localhost:8000/docs`
* **ReDoc API Documentation**: `http://localhost:8000/redoc`

All feature routes are grouped under the `/api/v1` prefix:
* `/api/v1/users/` (Auth, Login, Token Refresh, Me & User Directory)
* `/api/v1/agents/` (Agent CRUD, Execution, Stop, and Auto-Restart State)
* `/api/v1/documents/` (Knowledge Base, Document Uploads, and RAG Ingestion)
* `/api/v1/models/` (Local GGUF Models, Binary Upload with `GGUFReader`, Hugging Face Downloader)
* `/api/v1/chat/` (Direct Model Chat Sessions, SSE Real-Time Streaming, Tool Execution Loop)
* `/api/v1/runtime/` (Agent Worker Pool & `llama-server` Process Supervisor)
* `/api/v1/settings/` (System Governance, Enterprise Branding, and Concurrency Limits)

---

## ⚙️ Environment Variables (Optional)

The backend runs out of the box with sensible defaults, but you can configure the following environment variables:

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET_KEY` | Secret key used to sign and verify JWT access tokens | `agentic-workbench-secret-key-change-in-production` |
| `JWT_ALGORITHM` | Encryption algorithm for JWT tokens | `HS256` |
| `UPLOAD_DIR` | Local disk folder for uploaded knowledge documents | `uploads` |
| `AI_MODELS_DIR` | Local disk folder for downloaded / uploaded GGUF models | `models` |
| `LLAMA_CPP_BASE_URL` | Base URL for local llama-server API | `http://127.0.0.1:8080/v1` |

---

## 🛠️ Autonomous Built-In Tools (`app/tools/`)

The backend includes **19 deterministic, autonomous function-calling tools** registered in `app/tools/__init__.py`:

1. `read_file`: Line-range and byte-sliced local file reading.
2. `write_create_file`: Safe file creation with automatic parent directory scaffolding.
3. `edit_file`: Targeted search-and-replace text modifications.
4. `delete_rename_file`: Safe file/directory renaming or deletion.
5. `list_directory`: Recursive and bounded directory file tree traversal.
6. `search_files`: Regex and substring content searching across files.
7. `get_file_metadata`: File size, timestamp, permissions, and MIME inspection.
8. `parse_pdf`: Multi-page text and table extraction from PDF files.
9. `read_write_csv_excel_json_xml`: Structured data reader/writer supporting CSV, Excel, JSON, and XML.
10. `compress_extract_zip`: ZIP and TAR archive creation and extraction.
11. `web_search`: Air-gapped intranet or external web query execution.
12. `fetch_webpage`: Raw HTTP fetching with customizable headers and timeouts.
13. `extract_webpage_content`: Clean markdown and text extraction stripping scripts and styles.
14. `browse_links`: Link discovery and domain filtering from HTML pages.
15. `search_news`: Timestamped news search and article headline retrieval.
16. `search_images`: Image URL, dimensions, and caption lookup.
17. `download_files`: Resumable remote asset downloader with local path resolution.
18. `query_apis`: Parameterized REST HTTP requests (GET, POST, PUT, DELETE).
19. `python_execution`: Isolated in-process Python script runner with stdout/stderr capture.

---

## 📁 Project Architecture

```text
backend/
├── alembic/              # Database migration scripts & revision history
├── app/
│   ├── features/
│   │   ├── user/         # Auth (login, refresh, logout, me) & user CRUD
│   │   ├── agents/       # Agent CRUD, run, stop, running state tracking
│   │   ├── documents/    # Knowledge document upload, download, metadata
│   │   ├── ai_model/     # GGUF models, GGUFReader binary extraction, HF downloader
│   │   ├── chat/         # Interactive model chat, SSE streaming, multi-turn sessions
│   │   ├── runtime/      # Worker thread supervisor & llama-server controller
│   │   └── settings/     # Platform governance & dynamic enterprise attributes
│   ├── llm/              # OpenAI SDK client integration for local llama.cpp
│   ├── tools/            # 19 autonomous tools with standard JSON schemas
│   └── router.py         # Root API router assembling all feature routes
├── database/
│   ├── models/           # SQLAlchemy ORM models (User, Agent, AIModel, Conversation, etc.)
│   ├── database.py       # Engine & SessionLocal setup
│   └── seed.py           # Admin user database seeder
├── main.py               # FastAPI application entrypoint with lifespan recovery
├── build_llama.ps1       # Automated Windows build script for native llama.cpp
├── seed_data.py          # Workbench sample data seeder (models, documents)
├── test_all_tools.py     # Automated test suite for all 19 autonomous tools
├── pyproject.toml        # Project dependencies & metadata (uv / pip)
└── README.md             # Instructions & developer documentation
```

---

## 🧪 Running Automated Tests

Run the backend unit test suite:
```bash
uv run python -m unittest discover -s tests
```

Test all 19 autonomous built-in tools against live test cases:
```bash
uv run python test_all_tools.py
```

Verify end-to-end API health via Python test client:
```bash
uv run python -c "from fastapi.testclient import TestClient; from main import app; client = TestClient(app); print('API Status:', client.get('/').json())"
```

