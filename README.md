# RepoGraph AI

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Harshit036/repograph-ai)

An autonomous repository intelligence platform. Paste a GitHub URL, sign in with GitHub, and ask deep questions about any codebase — backed by hybrid RAG, a LangGraph agent, and a Neo4j-backed code graph.

![Tech Stack](https://img.shields.io/badge/FastAPI-backend-009688?style=flat-square) ![Next.js](https://img.shields.io/badge/Next.js_14-frontend-000000?style=flat-square) ![pgvector](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?style=flat-square) ![Neo4j](https://img.shields.io/badge/Neo4j-graph-008CC1?style=flat-square) ![LangGraph](https://img.shields.io/badge/LangGraph-agents-FF6B35?style=flat-square)

## Features

- **BYOK LLM** — bring your own Groq, OpenAI, Anthropic, or Ollama key; switch providers per-session from the settings modal
- **GitHub OAuth login** — sign in with GitHub, all data isolated per user
- **Smart re-ingestion** — skips re-cloning if the repo HEAD hasn't changed since last ingest
- **No server-side persistence** — only the current active repo lives in memory per user; chat history is session-only; sources open on GitHub instead of an in-app file viewer
- **Hybrid RAG** — query expansion, parallel BM25 + pgvector semantic search, RRF fusion, cross-encoder reranking, semantic dedup, MMR diversity, and Neo4j graph-neighbor expansion, all streamed over SSE with live pipeline "thinking" steps
- **LangGraph agent** — planner → retriever → reasoner → summarizer with up to 3 evidence-gathering cycles
- **Neo4j code graph** — imports/functions/classes/calls extracted via `ast` (Python) and tree-sitter (JS/TS/Go), powering retrieval expansion, dead-code detection, and test-coverage analysis
- **Rich answers** — inline clickable citation chips (open the exact source line on GitHub), Mermaid diagram rendering, syntax-highlighted code blocks with copy buttons, and KaTeX math
- **Tools panel** — onboarding guide, AI architecture summary, flow tracer, dead code finder, test coverage gaps
- **Global search** — file names, function/class names, and semantic code search across your ingested repos
- **PR review** — paste a GitHub PR URL to pull its diff into the workspace for review

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
| **Code graph** | Neo4j (imports/calls/classes/functions) |
| **Embeddings** | sentence-transformers `all-MiniLM-L6-v2` |
| **Reranking** | cross-encoder `ms-marco-MiniLM-L-6-v2` |
| **BM25** | rank-bm25 |
| **Code parsing** | tree-sitter + tree-sitter-language-pack |
| **Markdown rendering** | react-markdown, remark-gfm/math, rehype-highlight/katex, Mermaid |
| **Containerisation** | Docker + Docker Compose |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A GitHub OAuth App (for login) — see setup below
- An API key for at least one LLM provider (Groq is free and fast)
- Either a local Neo4j container (`--profile local-neo4j`) or a Neo4j AuraDB (cloud) instance

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

Edit `.env` — the defaults work for Docker, you only need to change `API_KEY` (and the `NEO4J_*` vars if using AuraDB):

```env
DATABASE_URL=postgresql+psycopg2://repograph:repograph@postgres:5432/repograph
POSTGRES_USER=repograph
POSTGRES_PASSWORD=repograph
POSTGRES_DB=repograph
API_KEY=changeme-dev-key        # change this to anything random
REPO_BASE_PATH=repositories

# Neo4j — defaults below are for the local `local-neo4j` profile.
# For AuraDB, set these to your cloud instance's bolt URI / credentials.
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=repograph123
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
# With a local Neo4j container
docker compose --profile local-neo4j up --build

# With Neo4j AuraDB (cloud) — set NEO4J_* vars in .env first
docker compose up --build
```

| Service | URL |
|---|---|
| **App (workspace)** | http://localhost:3000/workspace |
| **API docs (Swagger)** | http://localhost:8000/docs |
| **PostgreSQL** | localhost:5433 |
| **Neo4j Browser** (local profile only) | http://localhost:7474 |

> Port 5433 is used (not 5432) to avoid conflicts with any local PostgreSQL instance. Neo4j is non-fatal on failure — every call is wrapped so graph features degrade silently and RAG/ingestion still work without it.

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

# Start Neo4j (or point NEO4J_URI at an AuraDB instance instead)
docker run -d -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/repograph123 \
  neo4j:5.20-community

# Copy and edit .env (use localhost:5432 / localhost:7687 in the URLs above)
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
│   │   ├── migrations.py        # Creates users table + pgvector index on startup
│   │   └── neo4j.py             # Neo4j driver + graph read/write helpers (non-fatal on failure)
│   ├── middleware/
│   │   └── auth.py              # API key + X-LLM-* + X-User-Id header extraction
│   ├── routes/
│   │   ├── repo.py              # POST /ingest-repo · DELETE /repo/{id} · GET /pr-diff
│   │   ├── search.py            # POST /search · GET /search/global
│   │   ├── rag.py               # POST /rag-query (+ /stream)
│   │   ├── agent.py             # POST /agent-query
│   │   ├── graph.py             # GET /repository-graph
│   │   ├── flow.py              # GET /trace-flow
│   │   ├── architecture.py      # GET /architecture-summary (+ /stream)
│   │   ├── onboarding.py        # GET /onboarding-guide (+ /stream)
│   │   ├── analysis.py          # GET /dead-code · GET /test-coverage
│   │   └── stats.py             # GET /stats
│   ├── services/
│   │   ├── llm_service.py       # LangChain factory (Groq/OpenAI/Anthropic/Ollama)
│   │   ├── repo_service.py      # Git clone, smart re-ingest, tree-sitter chunking
│   │   ├── vector_db_service.py # PGVector store/search with user_id filter
│   │   ├── hybrid_retrieval_service.py  # BM25 + semantic + RRF
│   │   ├── graph_service.py / graph_extractors.py  # AST/tree-sitter graph extraction → Neo4j
│   │   ├── graph_retrieval_service.py   # Neo4j neighbor expansion for RAG context
│   │   ├── dead_code_service.py         # Functions with no incoming call edges
│   │   ├── test_coverage_service.py     # Production functions with no test coverage
│   │   └── ...
│   └── storage/
│       └── user_stores.py       # In-memory per-user chunk store + active-repo registry
├── frontend/
│   ├── app/
│   │   ├── workspace/page.tsx   # Main 3-panel workspace (the only app surface)
│   │   └── login/page.tsx       # GitHub sign-in page
│   ├── components/
│   │   ├── workspace/
│   │   │   ├── LeftPanel.tsx    # Repo URL input, ingest, PR diff loader
│   │   │   ├── CenterPanel.tsx  # Chat (RAG / Agent toggle), citations, Mermaid, thinking steps
│   │   │   └── RightPanel.tsx   # Tools (onboarding / architecture / trace / dead code / test coverage)
│   │   └── LLMSettingsModal.tsx # Provider + model + API key picker
│   ├── lib/
│   │   ├── auth.ts              # NextAuth config (GitHub provider)
│   │   ├── github.ts            # Builds GitHub blob URLs for citations/sources
│   │   └── api.ts               # Axios client with auth headers
│   ├── store/workspace.ts       # Zustand store (persists llmConfig + user identity only)
│   └── middleware.ts            # Protects /workspace — redirects to /login
├── docker-compose.yml            # postgres · neo4j (profile) · api · frontend · ollama (profile)
├── Dockerfile                     # FastAPI image
└── frontend/Dockerfile            # Next.js image
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/ingest-repo` | Yes | Clone and index a GitHub repository |
| DELETE | `/repo/{repo_id}` | Yes | Remove an ingested repo's data |
| GET | `/pr-diff` | Yes | Fetch changed files/diff for a GitHub PR URL |
| POST | `/search` | Yes | Semantic search over ingested chunks |
| GET | `/search/global` | Yes | Search file names, function names, and code across repos |
| POST | `/rag-query` | Yes | RAG question with source citations (`/stream` for SSE) |
| POST | `/agent-query` | Yes | LangGraph agent with multi-step reasoning |
| GET | `/architecture-summary` | Yes | LLM-generated architecture overview (`/stream` for SSE) |
| GET | `/onboarding-guide` | Yes | Developer onboarding guide with entry points (`/stream` for SSE) |
| GET | `/repository-graph` | Yes | Dependency graph JSON |
| GET | `/trace-flow?keyword=X` | Yes | Trace call chains matching a keyword |
| GET | `/dead-code` | Yes | Functions with no incoming call edges |
| GET | `/test-coverage` | Yes | Production functions with no corresponding test |
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
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j bolt endpoint (local container or AuraDB) |
| `NEO4J_USER` | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | `repograph123` | Neo4j password |
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
