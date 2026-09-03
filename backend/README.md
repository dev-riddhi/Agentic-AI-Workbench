# Agentic AI Workbench - Backend

FastAPI backend providing autonomous agent orchestration, local GGUF model management via Hugging Face, RAG document knowledge base, token-based authentication with refresh rotation, and system recovery.

---

## 🛠️ Prerequisites

* **Python**: `3.12+`
* **Package Manager**: [`uv`](https://docs.astral.sh/uv/) *(recommended)* or standard `pip`

---

## 🚀 Quickstart Guide

### 1. Navigate to the Backend Directory
```bash
cd backend
```

### 2. Install Dependencies
Using `uv`:
```bash
uv sync
```
*(Or with standard virtualenv)*:
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate
pip install -e .
```

---

### 3. Run Database Migrations
Initialize and update SQLite database (`database/app.db`) to the latest revision:
```bash
uv run alembic upgrade head
```

---

### 4. (Optional) Seed Default Admin User
To populate an initial admin user account:
```bash
uv run python database/seed.py
```
* **Default Email**: `admin@example.com`
* **Default Password**: `Password123!`

---

### 5. Start the Backend Server
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
* `/api/v1/users/` (Auth & User Management)
* `/api/v1/agents/` (Agents, Execution & Auto-Restart State)
* `/api/v1/documents/` (Knowledge Base & Document Uploads)
* `/api/v1/models/` (Hugging Face GGUF Models)

---

## ⚙️ Environment Variables (Optional)

The backend runs out of the box with sensible defaults, but you can configure the following environment variables:

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET_KEY` | Secret key used to sign and verify JWT access tokens | `agentic-workbench-secret-key-change-in-production` |
| `JWT_ALGORITHM` | Encryption algorithm for JWT tokens | `HS256` |
| `UPLOAD_DIR` | Local disk folder for uploaded knowledge documents | `uploads` |
| `AI_MODELS_DIR` | Local disk folder for downloaded Hugging Face GGUF models | `models` |

---

## 📁 Project Architecture

```text
backend/
├── alembic/              # Database migration scripts
├── app/
│   ├── features/
│   │   ├── user/         # Auth (login, refresh, logout, me) & user CRUD
│   │   ├── agents/       # Agent CRUD, run, stop, running state tracking
│   │   ├── documents/    # Knowledge document upload, download, metadata
│   │   └── ai_model/     # Hugging Face GGUF model download and registry
│   └── router.py         # Root API router assembling all feature routes
├── database/
│   ├── models/           # SQLAlchemy ORM models (User, Agent, AIModel, etc.)
│   ├── database.py       # Engine & SessionLocal setup
│   └── seed.py           # Admin user database seeder
├── main.py               # FastAPI application entrypoint with lifespan recovery
├── pyproject.toml        # Project dependencies & metadata
└── README.md             # Instructions & documentation
```

---

## 🧪 Running Automated Tests

Run the comprehensive test suite verifying authentication, agent lifecycle, documents, and GGUF model download:
```bash
uv run python -m unittest discover -s tests
```
Or run end-to-end API verification directly via Python test client:
```bash
uv run python -c "from fastapi.testclient import TestClient; from main import app; client = TestClient(app); print('API Status:', client.get('/').json())"
```
