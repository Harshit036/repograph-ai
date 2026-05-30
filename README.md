# RepoGraph AI

An autonomous repository intelligence platform. Paste a GitHub URL, sign in with GitHub, and ask deep questions about any codebase — backed by hybrid RAG, LangGraph agents, and an interactive dependency graph.

![Tech Stack](https://img.shields.io/badge/FastAPI-backend-009688?style=flat-square) ![Next.js](https://img.shields.io/badge/Next.js_14-frontend-000000?style=flat-square) ![pgvector](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?style=flat-square) ![LangGraph](https://img.shields.io/badge/LangGraph-agents-FF6B35?style=flat-square)

## Features

- **BYOK LLM** — bring your own Groq, OpenAI, Anthropic, or Ollama key; switch providers per-session from the settings modal
- **GitHub OAuth login** — sign in with GitHub, all data isolated per user
- **Smart re-ingestion** — skips re-cloning if the repo HEAD hasn't changed since last ingest
- **Hybrid RAG** — BM25 + pgvector semantic search, RRF fusion, cross-encoder reranking, MMR diversity
- **LangGraph agent** — planner → retriever → reasoner → summarizer with up to 3 evidence cycles
- **Repository graph** — static import/call analysis with interactive 3D visualisation
- **Tools panel** — onboarding guide, architecture summary, file tree, 3D graph, flow tracer

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | FastAPI + Uvicorn |
| **Frontend** | Next.js 14 (App Router) |
| **Auth** | NextAuth.js v5 · GitHub OAuth |
| **State** | Zustand (persist to localStorage) |
| **LLM** | LangChain unified interface — Groq / OpenAI / Anthropic / Ollama |
| **Agent** | LangGraph StateGraph |
| **Vector store** | PostgreSQL + pgvector (LangChain PGVector) |
| **Embeddings** | sentence-transformers `all-MiniLM-L6-v2` |
| **Reranking** | cross-encoder `ms-marco-MiniLM-L-6-v2` |
| **BM25** | rank-bm25 |
| **Code parsing** | tree-sitter + tree-sitter-language-pack |
| **Containerisation** | Docker + Docker Compose |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A GitHub OAuth App (for login) — see setup below
- An API key for at least one LLM provider (Groq is free and fast)

## Quick Start (Docker — recommended)

### 1. Clone the repo

```bash
git clone https://github.com/Harshit036/repograph-ai.git
cd repograph-ai
```

### 2. Create backend environment file

```bash
cp .env.example .env
```

Edit `.env` — the defaults work for Docker, you only need to change `API_KEY`:

```env
DATABASE_URL=postgresql+psycopg2://repograph:repograph@postgres:5432/repograph
POSTGRES_USER=repograph
POSTGRES_PASSWORD=repograph
POSTGRES_DB=repograph
API_KEY=changeme-dev-key        # change this to anything random
REPO_BASE_PATH=repositories
```

### 3. Create frontend environment file

```bash
cp frontend/.env.example frontend/.env.local
```

Fill in the four NextAuth values (see [GitHub OAuth App setup](#github-oauth-app-setup) below):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=changeme-dev-key     # must match API_KEY in .env above

GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
NEXTAUTH_SECRET=your_generated_secret    # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

### 4. Start the stack

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| **App (workspace)** | http://localhost:3000/workspace |
| **API docs (Swagger)** | http://localhost:8000/docs |
| **PostgreSQL** | localhost:5433 |

> Port 5433 is used (not 5432) to avoid conflicts with any local PostgreSQL instance.

---

## GitHub OAuth App Setup

1. Go to **github.com/settings/developers** → **OAuth Apps** → **New OAuth App**
2. Fill in:
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. Click **Register application**
4. Copy the **Client ID** → `GITHUB_CLIENT_ID`
5. Click **Generate a new client secret** → `GITHUB_CLIENT_SECRET`
6. Generate `NEXTAUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

For production deployment, create a second OAuth App (or update the existing one) with your production domain as the callback URL.

---

## Quick Start (Local dev — without Docker)

```bash
# Backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL with pgvector
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=repograph \
  -e POSTGRES_PASSWORD=repograph \
  -e POSTGRES_DB=repograph \
  ankane/pgvector

# Copy and edit .env (use localhost:5432 in DATABASE_URL)
cp .env.example .env
uvicorn app.main:app --reload
```

```bash
# Frontend (separate terminal)
cd frontend
cp .env.example .env.local   # fill in GitHub OAuth + NextAuth values
npm install
npm run dev
```

---

## LLM Providers (BYOK)

After signing in, click the provider badge in the top-right header to open the settings modal. Paste your API key — it's stored only in your browser's localStorage and sent per-request via `X-LLM-Key` header.

| Provider | Free tier | Models |
|---|---|---|
| **Groq** | Yes (fast, recommended) | `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` |
| **OpenAI** | No | `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo` |
| **Anthropic** | No | `claude-opus-4-5`, `claude-sonnet-4-5` |
| **Ollama** | Local only | any model you have pulled |

Get a free Groq key at [console.groq.com](https://console.groq.com).

---

## Project Structure

```
repograph-ai/
├── app/
│   ├── agents/                  # LangGraph nodes (planner/retriever/reasoner/summarizer)
│   ├── core/
│   │   ├── config.py            # pydantic-settings BaseSettings
│   │   ├── llm_context.py       # ContextVar for per-request LLM config
│   │   └── user_context.py      # ContextVar for per-request user_id
│   ├── db/
│   │   └── migrations.py        # Creates users + user_repos tables on startup
│   ├── middleware/
│   │   └── auth.py              # API key + X-LLM-* + X-User-Id header extraction
│   ├── routes/
│   │   ├── repo.py              # POST /ingest-repo · GET /my-repos
│   │   ├── rag.py               # POST /rag-query
│   │   ├── agent.py             # POST /agent-query
│   │   ├── graph.py             # GET /repository-graph
│   │   ├── stats.py             # GET /stats
│   │   └── ...
│   ├── services/
│   │   ├── llm_service.py       # LangChain factory (Groq/OpenAI/Anthropic/Ollama)
│   │   ├── repo_service.py      # Git clone, smart re-ingest, tree-sitter chunking
│   │   ├── vector_db_service.py # PGVector store/search with user_id filter
│   │   ├── hybrid_retrieval_service.py  # BM25 + semantic + RRF
│   │   └── ...
│   └── storage/
│       └── user_stores.py       # Per-user in-memory chunk + graph stores
├── frontend/
│   ├── app/
│   │   ├── workspace/page.tsx   # Main 3-panel workspace
│   │   ├── login/page.tsx       # GitHub sign-in page
│   │   └── (with-sidebar)/      # Legacy pages (graph, architecture, etc.)
│   ├── components/
│   │   ├── workspace/
│   │   │   ├── LeftPanel.tsx    # Repo URL input + history
│   │   │   ├── CenterPanel.tsx  # Chat (RAG / Agent toggle)
│   │   │   └── RightPanel.tsx   # Tools (guide / arch / tree / graph / trace)
│   │   └── LLMSettingsModal.tsx # Provider + model + API key picker
│   ├── lib/
│   │   ├── auth.ts              # NextAuth config (GitHub provider)
│   │   └── api.ts               # Axios client with auth headers
│   ├── store/workspace.ts       # Zustand store (persists llmConfig + user identity)
│   └── middleware.ts            # Protects /workspace — redirects to /login
├── docker-compose.yml
├── Dockerfile                   # FastAPI image
└── frontend/Dockerfile          # Next.js image
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/ingest-repo` | Yes | Clone and index a GitHub repository |
| GET | `/my-repos` | Yes | List repositories ingested by the current user |
| POST | `/rag-query` | Yes | RAG question with source citations |
| POST | `/agent-query` | Yes | LangGraph agent with multi-step reasoning |
| GET | `/architecture-summary` | Yes | LLM-generated architecture overview |
| GET | `/onboarding-guide` | Yes | Developer onboarding guide with entry points |
| GET | `/repository-graph` | Yes | Dependency graph JSON |
| GET | `/trace-flow?keyword=X` | Yes | Trace call chains matching a keyword |
| GET | `/repository-tree` | Yes | File tree with sunburst data |
| GET | `/stats` | Yes | Chunk / file / function counts |

Authenticated endpoints require `X-API-Key`. LLM endpoints additionally read `X-LLM-Provider`, `X-LLM-Model`, and `X-LLM-Key` headers (set automatically by the frontend from your saved settings).

---

## Environment Variables Reference

### Backend (`.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `POSTGRES_USER/PASSWORD/DB` | `repograph` | Used by Docker Compose to init the DB |
| `API_KEY` | `changeme-dev-key` | Shared secret between frontend and backend |
| `REPO_BASE_PATH` | `repositories` | Where cloned repos are stored |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint (only needed if using Ollama) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_API_KEY` | Must match `API_KEY` in backend `.env` |
| `GITHUB_CLIENT_ID` | From your GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | From your GitHub OAuth App |
| `NEXTAUTH_SECRET` | Random string — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Full URL of the frontend (e.g. `http://localhost:3000`) |

---

## Running Tests

```bash
pytest tests/ -v --cov=app
```
