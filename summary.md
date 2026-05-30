# RepoGraph AI — Complete Project Summary
*Context document for continuing development in a new chat window*

---

## 1. Who Is the User

- Name: Harshit Vaish (email: harshitvaish135@gmail.com)
- Building this project for **resume / portfolio purposes** — every technology listed on the resume must actually be implemented in the codebase
- Prefers **concise, direct communication** — no trailing summaries, no recapping
- Wants the project to look production-grade and well-developed
- Is comfortable with technical depth but appreciates clear explanations when asked
- Uses a Mac (Darwin 25.5.0, Apple Silicon implied), has Docker Desktop installed, has EnterpriseDB PostgreSQL 18 running locally on port 5432 (causes conflicts with Docker)

---

## 2. Project Overview

**RepoGraph AI** is an autonomous repository intelligence platform. You point it at a GitHub repository, it clones the repo, parses all source files using tree-sitter, generates vector embeddings for every function/class, stores them in PostgreSQL with pgvector, and then lets you:

- Ask natural language questions about the codebase (RAG with citations)
- Run a multi-agent LangGraph investigation that plans → retrieves → reasons → summarizes
- Visualize the repository as a 3D dependency graph (Plotly Scatter3d)
- Visualize the file/directory structure as an interactive sunburst chart
- Get an auto-generated architecture summary
- Get an auto-generated onboarding guide for new developers
- Trace function call chains by keyword

The project started as a 25-day learning project and was then upgraded to production-grade to match resume claims.

---

## 3. Resume Claims → What Was Implemented

The original resume listed technologies that weren't in the codebase. Every claim was implemented:

| Resume Claim | Implementation |
|---|---|
| **LangChain** | `langchain-postgres` PGVector for vector storage; `langchain-core` Embeddings ABC |
| **LangGraph** | Full `StateGraph` in `app/agents/coordinator.py` with 4 nodes and conditional edges |
| **PostgreSQL** | `ankane/pgvector` Docker image; `langchain_pg_embedding` tables; psycopg2 direct queries |
| **pgvector** | `CREATE EXTENSION vector`; `embedding <->` cosine distance operator for ANN search |
| **Docker** | `Dockerfile` (FastAPI), `Dockerfile.streamlit` (now unused), `Dockerfile` (Next.js frontend), `docker-compose.yml` |
| **React** | Replaced with Next.js 14 (user preferred keeping Python-based initially, then moved to Next.js) |
| **Tree-sitter** | Multi-language AST chunking: Python, JS, TS, Go via `tree-sitter-language-pack` |

---

## 4. Full Tech Stack

### Backend
| Layer | Technology | Details |
|---|---|---|
| **API Framework** | FastAPI 0.136 + Uvicorn | 11 routers, lifespan context manager |
| **LLM** | Ollama (local) OR Groq API | Configurable via `LLM_PROVIDER` env var |
| **Local LLM model** | `qwen2.5-coder:7b` | Runs via Ollama on host machine |
| **Cloud LLM** | Groq `llama-3.3-70b-versatile` | Free tier; replaces Ollama for cloud deployment |
| **Agent Orchestration** | LangGraph 1.2.2 | StateGraph, conditional edges, TypedDict state |
| **Vector Store** | PostgreSQL + pgvector via LangChain PGVector | `langchain-postgres` package |
| **Embeddings** | `all-MiniLM-L6-v2` | sentence-transformers, 384-dim vectors |
| **Reranking** | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Neural reranking after hybrid retrieval |
| **BM25** | `rank-bm25` | Keyword search, fused with semantic via RRF |
| **Code Parsing** | `tree-sitter-language-pack 1.8.1` | Python, JS, TS, Go AST extraction |
| **Auth** | `X-API-Key` header middleware | `BaseHTTPMiddleware`, OPTIONS bypass for CORS |
| **Config** | `pydantic-settings` BaseSettings | Reads `.env`, `@lru_cache get_settings()` |
| **DB Driver** | `psycopg2-binary` + `psycopg[binary]` | Both used — psycopg2 for direct queries |

### Frontend
| Layer | Technology | Details |
|---|---|---|
| **Framework** | Next.js 14 App Router | TypeScript, all client components |
| **Styling** | Tailwind CSS 3.4 | Custom dark palette, JetBrains Mono font |
| **Icons** | lucide-react | Consistent icon set throughout |
| **HTTP Client** | axios | 120s timeout, centralized in `lib/api.ts` |
| **Graphs** | `plotly.js-dist-min` | Dynamic import in useEffect (no SSR), 3D Scatter3d + Sunburst |
| **Build** | `output: standalone` in `next.config.mjs` | For Docker multi-stage build |

### Infrastructure
| Layer | Technology | Details |
|---|---|---|
| **Containers** | Docker Compose | 3 services: postgres, api, frontend |
| **DB Image** | `ankane/pgvector:latest` | PostgreSQL with pgvector pre-installed |
| **Port mapping** | `5433:5432` for postgres | Host 5432 is used by EnterpriseDB PG18 locally |
| **CORS** | `CORSMiddleware` | Allows `localhost:3000` and `127.0.0.1:3000` |
| **CI** | GitHub Actions | ubuntu-latest, Python 3.11, postgres service, ruff + pytest |
| **Tests** | 42 pytest tests | 5 test files, all mocked (no real DB/LLM needed) |

---

## 5. Complete File Structure

```
repograph-ai/
├── app/
│   ├── agents/
│   │   ├── coordinator.py        # LangGraph StateGraph — main orchestrator
│   │   ├── state.py              # AgentState TypedDict
│   │   ├── planner_agent.py      # Query decomposition + replanning
│   │   ├── retriever_agent.py    # Tool-use retrieval (semantic + keyword)
│   │   ├── reasoner_agent.py     # Evidence critique, gap detection, reflection
│   │   ├── summarizer_agent.py   # Final grounded answer synthesis
│   │   ├── repository_agent.py   # (Legacy — kept for reference)
│   │   └── tools.py              # Tool definitions for retriever
│   ├── core/
│   │   └── config.py             # pydantic-settings BaseSettings + get_settings()
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── auth.py               # APIKeyMiddleware — returns JSONResponse (not raise)
│   ├── routes/
│   │   ├── repo.py               # POST /ingest-repo
│   │   ├── rag.py                # POST /rag-query
│   │   ├── agent.py              # POST /agent-query
│   │   ├── graph.py              # GET /repository-graph
│   │   ├── tree.py               # GET /repository-tree  (sunburst data)
│   │   ├── architecture.py       # GET /architecture-summary
│   │   ├── onboarding.py         # GET /onboarding-guide
│   │   ├── flow.py               # GET /trace-flow
│   │   ├── search.py             # POST /search
│   │   ├── stats.py              # GET /stats
│   │   └── chat.py               # POST /chat
│   ├── services/
│   │   ├── vector_db_service.py  # LangChain PGVector — store_chunk, search_similar_chunks
│   │   ├── hybrid_retrieval_service.py  # BM25 + semantic + RRF fusion
│   │   ├── reranking_service.py  # neural_rerank, semantic_deduplicate, mmr
│   │   ├── rag_service.py        # Full RAG pipeline
│   │   ├── chunking_service.py   # tree-sitter multi-language AST chunker
│   │   ├── embedding_service.py  # sentence-transformers wrapper
│   │   ├── llm_service.py        # Ollama/Groq router — generate_response()
│   │   ├── repo_service.py       # Git clone (ephemeral temp dir) + scan
│   │   ├── graph_service.py      # Build in-memory repository_graph
│   │   ├── tree_service.py       # Build sunburst data from repository_graph
│   │   ├── architecture_service.py
│   │   ├── onboarding_service.py
│   │   ├── flow_tracing_service.py
│   │   ├── graph_retrieval_service.py  # get_graph_neighbors()
│   │   └── retrieval_service.py  # (Legacy direct semantic search)
│   ├── storage/
│   │   ├── repository_graph.py   # In-memory dict: file_path → {functions, imports, calls}
│   │   └── chunk_store.py        # In-memory list for BM25 corpus
│   └── main.py                   # FastAPI app, lifespan, CORS, middleware, routers
│
├── frontend/                     # Next.js 14 application
│   ├── app/
│   │   ├── globals.css           # Tailwind + JetBrains Mono + custom scrollbar
│   │   ├── layout.tsx            # Root layout with Sidebar
│   │   ├── page.tsx              # Dashboard — live stats + quick actions
│   │   ├── ingest/page.tsx       # GitHub URL → ingest
│   │   ├── query/page.tsx        # RAG query with citation cards
│   │   ├── agent/page.tsx        # Agent with step trace timeline
│   │   ├── graph/page.tsx        # 3D Plotly dependency graph
│   │   ├── tree/page.tsx         # Sunburst repo tree (new)
│   │   ├── architecture/page.tsx
│   │   ├── onboarding/page.tsx
│   │   └── trace/page.tsx        # Flow trace with expandable call chains
│   ├── components/
│   │   └── Sidebar.tsx           # Fixed left sidebar, active-state highlight
│   ├── lib/
│   │   └── api.ts                # Typed axios client for all endpoints
│   ├── Dockerfile                # Multi-stage: deps → builder → runner (standalone)
│   ├── package.json              # next 14.2.5, plotly.js-dist-min, lucide-react, clsx
│   ├── tailwind.config.ts        # Custom colors: bg, surface, s2, border, accent, muted
│   ├── tsconfig.json             # target: es2017
│   ├── next.config.mjs           # output: standalone
│   └── .gitignore                # .next/, node_modules/, .env.local
│
├── tests/
│   ├── conftest.py               # Fixtures: mock_llm, mock_embedding, mock_vector_db, sample_chunk_store
│   ├── test_chunking_service.py
│   ├── test_hybrid_retrieval.py
│   ├── test_reranking_service.py
│   ├── test_rag_service.py
│   └── test_auth_middleware.py
│
├── .github/workflows/ci.yml      # GitHub Actions CI
├── Dockerfile                    # FastAPI backend (python:3.11-slim)
├── Dockerfile.streamlit          # (Unused — kept for reference)
├── docker-compose.yml            # postgres + api + frontend (3 services)
├── requirements.txt              # All Python deps including groq>=0.9.0
├── pytest.ini                    # pytest config
├── .env                          # Local secrets (gitignored)
├── .env.example                  # Template without secrets
└── README.md                     # Full documentation
```

---

## 6. API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Health check — `{"status": "ok"}` |
| GET | `/stats` | Yes | `{repos, files, chunks, functions}` counts |
| POST | `/ingest-repo` | Yes | `{repo_url}` → clone, parse, embed, store |
| POST | `/rag-query` | Yes | `{query}` → `{response, citations[]}` |
| POST | `/agent-query` | Yes | `{query}` → `{response, actions[], memory{}}` |
| GET | `/repository-graph` | Yes | Full in-memory graph as JSON |
| GET | `/repository-tree` | Yes | Plotly sunburst data `{ids, labels, parents, values, ...}` |
| GET | `/architecture-summary` | Yes | `{summary}` — LLM-generated |
| GET | `/onboarding-guide` | Yes | `{guide, entry_points[]}` |
| GET | `/trace-flow?keyword=X` | Yes | `[{function, file, calls[]}]` |
| POST | `/search` | Yes | Direct semantic search |
| POST | `/chat` | Yes | General LLM chat |

---

## 7. Data Flow — End to End

### Ingestion Flow
```
POST /ingest-repo
  → clone_repository(url)       # tempfile.mkdtemp() — ephemeral, deleted after
  → scan_repository(path)
      for each file (.py/.js/.ts/.go):
        → chunk_file(content, ext)           # tree-sitter AST → functions/classes
        → generate_embedding(chunk.content)  # all-MiniLM-L6-v2 → 384-dim vector
        → store_chunk(id, embedding, text, metadata)
              → PGVector.add_embeddings()    # INSERT into langchain_pg_embedding
        → chunk_store.append(...)            # in-memory BM25 corpus
  → build_repository_graph(data)            # static analysis: imports, calls
  → cleanup_repository(path)               # shutil.rmtree(temp_dir)
```

### RAG Query Flow
```
POST /rag-query {query}
  → generate_embedding(query)              # 384-dim query vector
  → hybrid_search(query, vector, top_k=10)
      → search_similar_chunks(vector)      # pgvector <-> distance, top 20
      → bm25_search(query)                 # BM25Okapi on in-memory chunk_store
      → reciprocal_rank_fusion([sem, bm25])  # RRF merge
  → neural_rerank(query, pairs, top_k=8)   # cross-encoder ms-marco-MiniLM
  → semantic_deduplicate(pairs, 0.92)      # cosine similarity dedup
  → mmr(query, pairs)                      # max marginal relevance for diversity
  → for each (doc, meta): get_graph_neighbors(file_path)  # expand context
  → generate_response(prompt)              # Ollama or Groq
  → return {response, citations[]}
```

### Agent Flow (LangGraph)
```
POST /agent-query {query}
  → StateGraph.invoke(initial_state)
      node_planner  → plan steps (LLM call)
      node_retriever → for each step: retrieve via semantic + keyword search
      node_reasoner  → critique gaps, self-correct, decide if enough evidence
        if enough_evidence OR iteration >= 3:
          → node_summarizer → final answer (LLM call)
        else:
          → node_planner (replan, loop)
  → return {response, actions[], memory{discovered_facts, searched_queries}}
```

### Startup Flow
```
FastAPI lifespan → init_db()
  → PGVector.create_vector_extension()    # CREATE EXTENSION IF NOT EXISTS vector
  → PGVector.create_tables_if_not_exists()
  → PGVector.create_collection()
  → _reload_memory_stores()              # reload chunk_store + repo_graph from DB
      → psycopg2 SELECT from langchain_pg_embedding
      → populate chunk_store (BM25 corpus)
      → populate repository_graph (basic file list)
```

---

## 8. Key Architecture Decisions

### PostgreSQL / LangChain
- Uses **thin adapter pattern** in `vector_db_service.py` — same public API (`store_chunk`, `search_similar_chunks` returning ChromaDB-compatible dict shape) so all callers needed zero changes when switching from ChromaDB
- `add_embeddings()` used (not `add_texts()`) because embeddings are pre-computed — avoids double-embedding
- `use_jsonb=True` — metadata stored as PostgreSQL JSONB for indexability
- Tables: `langchain_pg_collection` (named collections) + `langchain_pg_embedding` (vectors + text + metadata)

### Auth Middleware
- **Must return `JSONResponse` directly** — never `raise HTTPException` inside `BaseHTTPMiddleware.dispatch()`. Raising causes Starlette to wrap it as 500 instead of 401.
- OPTIONS requests are passed through (CORS preflight bypass)
- Public paths: `/health`, `/docs`, `/openapi.json`, `/redoc`, `/docs/oauth2-redirect`
- **Middleware ordering matters**: `CORSMiddleware` added first (innermost), `APIKeyMiddleware` added second (outermost). CORS headers are applied after auth check passes.

### LangGraph Agent
- `AgentState` is a `TypedDict` — all fields must be returned from every node (use `{**state, ...updates}` pattern)
- MAX_ITERATIONS = 3 to prevent infinite loops
- Conditional edge on `reasoner` node: enough_evidence OR iteration ≥ 3 → summarizer, else → planner

### Ephemeral Cloning
- Repos cloned to `tempfile.mkdtemp()`, deleted via `shutil.rmtree()` in `finally` block after ingestion
- No source files persist on disk after embedding extraction
- Re-ingesting a repo re-clones from GitHub (no caching)

### BM25 Persistence
- `chunk_store` (list) and `repository_graph` (dict) are in-memory and survive only for the process lifetime
- On startup, `_reload_memory_stores()` queries PostgreSQL to repopulate them
- **Limitation**: `repository_graph` only gets file paths on reload (not full function/import data), because that data isn't stored in the DB — full graph requires re-ingestion after restart

### Next.js + Plotly
- Plotly is browser-only — imported with `await import('plotly.js-dist-min')` inside `useEffect`
- No `react-plotly.js` wrapper — direct `Plotly.newPlot()` call on a ref
- All pages are client components (`"use client"`) because they use `useState` / `useEffect`
- `NEXT_PUBLIC_API_URL` is embedded at **build time** in Next.js — set via Docker build args

### CORS Fix
- Browser sends `OPTIONS` preflight before any cross-origin request
- Auth middleware originally blocked OPTIONS with 401 → fixed with `request.method == "OPTIONS"` bypass
- `allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"]` — needs to be expanded for production deployment

---

## 9. Configuration (.env)

```env
# Database
DATABASE_URL=postgresql+psycopg2://repograph:repograph@localhost:5432/repograph
POSTGRES_USER=repograph
POSTGRES_PASSWORD=repograph
POSTGRES_DB=repograph

# LLM — choose one provider
LLM_PROVIDER=groq            # "ollama" (local) or "groq" (cloud)
OLLAMA_MODEL=qwen2.5-coder:7b
OLLAMA_BASE_URL=http://localhost:11434
GROQ_API_KEY=gsk_...         # get from console.groq.com (free)
GROQ_MODEL=llama-3.3-70b-versatile   # llama3-70b-8192 is DECOMMISSIONED

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIM=384

# Auth
API_KEY=changeme-dev-key     # sent as X-API-Key header from frontend

# App
REPO_BASE_PATH=repositories
DEBUG=false
```

---

## 10. Running the Project

### Docker (recommended)
```bash
# Make sure Docker Desktop is open
# If local PostgreSQL is on port 5432, it conflicts — either kill it or keep 5433 mapping in docker-compose.yml

docker compose up --build

# Services:
# Frontend: http://localhost:3000
# API:      http://localhost:8000
# API docs: http://localhost:8000/docs
# Postgres: localhost:5433 (host) / 5432 (internal)
```

### Local development
```bash
# Terminal 1: Start PostgreSQL (via Docker or local)
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=repograph \
  -e POSTGRES_PASSWORD=repograph \
  -e POSTGRES_DB=repograph \
  ankane/pgvector

# Terminal 2: Start Ollama (if not using Groq)
ollama serve
ollama pull qwen2.5-coder:7b

# Terminal 3: Backend
cd repograph-ai
source venv/bin/activate
uvicorn app.main:app --reload

# Terminal 4: Frontend
cd frontend
npm run dev  # → http://localhost:3000
```

### Known Port Conflicts
- The user has **EnterpriseDB PostgreSQL 18** running on port 5432
- docker-compose.yml maps postgres to **5433:5432** (host:container) to avoid conflict
- To kill local PG: `sudo kill <pid>` or `sudo launchctl stop com.edb.launchd.postgresql-18`
- Cannot use `sudo pg_ctl stop` as root — must use `-u postgres` user

---

## 11. Git History

```
1716590  Add Groq LLM, repo tree sunburst, ephemeral cloning, BM25 persistence
6504106  Fix CORS and OPTIONS preflight for Next.js frontend
1a97518  Replace Streamlit with Next.js 14 frontend (dark dev-tool theme)
ff0a32a  Update README with full production stack documentation
6d44edd  Add production infrastructure: LangChain/PGVector, LangGraph, Docker, auth, tests
af9f7e5  README update
bc24a2c  Fix chunk metadata keys, add attribute call detection, update dependencies
ff9afc7  Add iterative planner-executor agent with tool use and reflection
395eb46  Add RAG pipeline with deduplication and reranking
38c985e  Add embedding pipeline and semantic vector search
b4832a6  Add AST-based semantic chunking pipeline
9f3e197  README updated
5da6598  Initial FastAPI backend with Ollama integration
```

---

## 12. Known Issues / Limitations

1. **repository_graph loses function/import data on restart** — `_reload_memory_stores()` only restores file paths (not functions/imports/calls) because that data isn't stored in the DB. Architecture summary and flow tracing won't work after restart without re-ingesting. **Fix needed**: store graph data in PostgreSQL or a separate table.

2. **CORS allow_origins is hardcoded to localhost** — for production deployment, this needs to be the actual frontend domain. Currently `["http://localhost:3000", "http://127.0.0.1:3000"]`.

3. **Ollama in Docker** — uses `host.docker.internal:11434` to reach Ollama on the host Mac. This is hardcoded in docker-compose.yml `environment` block to override the `.env` value of `localhost:11434`.

4. **Old streamlit orphan container** — Docker warns about `repograph-ai-streamlit-1` orphan. Run `docker compose up --remove-orphans` to clean it.

5. **`chunk_store` and `repository_graph` are not thread-safe** — concurrent ingestions would corrupt state. Acceptable for single-user local dev.

6. **Architecture/Onboarding return stale data if no repo ingested** — show "No repository has been ingested yet" message. This is correct behavior but the frontend error message says "Failed to generate" which is misleading.

---

## 13. Deployment Plan (Next Steps)

The user wants to deploy the project to the cloud. Agreed approach:

### Target Stack
| Service | Provider | Notes |
|---|---|---|
| **PostgreSQL + pgvector** | **Supabase** or **Neon** | Both have pgvector, free tier. Supabase preferred (more features). |
| **API backend** | **Railway** or **Render** | Docker-native, auto-deploy from GitHub push |
| **Frontend** | **Vercel** | Zero-config Next.js deployment |
| **LLM** | **Groq API** | Already integrated — `LLM_PROVIDER=groq`, free tier `llama-3.3-70b-versatile` |
| **Embeddings** | Keep sentence-transformers | Runs in the API container, no external service needed |

### What Needs to Change for Deployment
1. `CORS allow_origins` — add production frontend URL
2. `NEXT_PUBLIC_API_URL` — set to production API URL (Railway/Render domain)
3. `DATABASE_URL` — point to Supabase/Neon cloud PostgreSQL
4. `API_KEY` — change from `changeme-dev-key` to a real secret
5. **Environment variables** on Railway/Render: all vars from `.env` except local-only ones
6. **Ollama** — not needed (using Groq); remove from docker-compose for production
7. `allow_origins` needs wildcard or specific Vercel domain

### What Does NOT Need to Change
- The FastAPI code — Groq already works
- The Next.js code — just update env vars
- The Docker setup — Railway/Render can use the existing Dockerfile

---

## 14. Frontend Design System

- **Background**: `#09090b` (zinc-950)
- **Surface (cards)**: `#18181b` (zinc-900)
- **Surface 2 (inputs)**: `#27272a` (zinc-800)
- **Border**: `#3f3f46` (zinc-700)
- **Accent**: `#8b5cf6` (violet-500)
- **Muted text**: `#71717a` (zinc-500)
- **Success**: `#10b981` (emerald-500)
- **Danger**: `#ef4444` (red-500)
- **Code font**: JetBrains Mono
- **Body font**: Inter

### Pages
| Route | Page | Key Feature |
|---|---|---|
| `/` | Dashboard | Live stats cards (repos/files/chunks/functions) + API status pill + quick actions grid |
| `/ingest` | Ingest | GitHub URL → file list with chunk counts |
| `/query` | RAG Query | Split: response with inline code + collapsible citation cards |
| `/agent` | Agent | Color-coded step trace timeline + memory panels (facts + queries) |
| `/graph` | Dep. Graph | Full-screen 3D Plotly Scatter3d, drag to rotate, Z = function count |
| `/tree` | Repo Tree | Plotly Sunburst — rings = directory depth, size = chunks, color = file type, click to zoom |
| `/architecture` | Architecture | Generate button → markdown response |
| `/onboarding` | Onboarding | Entry points table + guide markdown |
| `/trace` | Flow Trace | Keyword → expandable call-chain cards with arrow separators |

---

## 15. Important Bug Fixes Made During Development

1. **Auth middleware returning 500 instead of 401** — Must return `JSONResponse` directly, never `raise HTTPException` inside `BaseHTTPMiddleware.dispatch()`
2. **mock_vector_db fixture not intercepting** — `hybrid_retrieval_service` imports `search_similar_chunks` at import time; must patch `app.services.hybrid_retrieval_service.search_similar_chunks` not the source module
3. **PGVector crashes in tests** — `PGVector.__post_init__` connects to DB immediately; mock the entire service layer
4. **Plotly `titlefont` error** — Use `title=dict(text="...", font=dict(...))` not separate `title=` and `titlefont=`
5. **Docker OLLAMA_BASE_URL** — `.env` has `localhost:11434`; docker-compose `environment:` block must hardcode `host.docker.internal:11434` to override (not use `${VAR:-default}` syntax since `.env` sets the var)
6. **CORS preflight 401** — OPTIONS requests blocked by auth middleware; fixed with `request.method == "OPTIONS"` check
7. **Groq model decommissioned** — `llama3-70b-8192` decommissioned; use `llama-3.3-70b-versatile`
8. **tree-sitter API** — `tree.root_node()` is a method call (not property), `node.kind()` returns string, `node.start_position()` returns Point object with `.row` attribute
9. **Next.js `NEXT_PUBLIC_*` vars** — embedded at build time, not runtime; must pass as Docker build args: `args: NEXT_PUBLIC_API_URL: http://localhost:8000`

---

## 16. User Preferences & Decisions

- **Frontend**: Next.js 14 over React (same technology, better DX) — dark dev-tool aesthetic
- **Design**: Dark background (`#09090b`), violet accent (`#8b5cf6`), JetBrains Mono for code
- **LLM for deployment**: Groq API (free tier) over keeping Ollama on VPS
- **Graph visualization**: Sunburst chart for repo tree (over 3D tree or treemap)
- **Repo storage**: Ephemeral — clone to temp, extract embeddings, delete
- **No React** — kept Next.js (user explicitly chose Next.js over plain React or Streamlit)
- **No Streamlit** — removed entirely, replaced with Next.js
- **Single commit preference** — user prefers bundling related changes in one commit
- **Port conflict**: keeps local EnterpriseDB running; docker-compose uses `5433:5432`

---

## 17. What to Discuss / Build Next

Based on the conversation ending point, these are the identified next steps:

1. **Deployment** — Deploy to cloud (Supabase DB + Railway API + Vercel frontend)
2. **repository_graph persistence** — Store function/import data in PostgreSQL so it survives restart
3. **CORS production config** — Update allow_origins for production domain
4. **API_KEY security** — Generate a real secret key for production
5. **Streamlit orphan cleanup** — `docker compose up --remove-orphans`
6. **Frontend polish** — Any additional UI improvements the user wants
7. **Additional features** — User mentioned "there are few changes I need to make but that we will do later"

The user's stated next topic: **deployment stage** — cloud hosting of the full stack.
