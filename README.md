# RepoGraph AI

An autonomous repository intelligence platform that combines semantic search, graph-based code reasoning, and agentic planning to answer deep questions about any codebase.

## Features

### Multi-language Code Parsing
- Clone and ingest GitHub repositories via GitPython
- Tree-sitter AST chunking for Python, JavaScript, TypeScript, and Go
- Extracts functions, classes, and methods as discrete semantic units
- Raw line-block fallback for unsupported file types

### Hybrid Retrieval & RAG
- Semantic vector search via PostgreSQL + pgvector (LangChain PGVector)
- BM25 keyword search over in-memory chunk store
- Reciprocal Rank Fusion (RRF) to merge semantic and keyword rankings
- Cross-encoder neural reranking (`ms-marco-MiniLM-L-6-v2`)
- Semantic deduplication + Maximal Marginal Relevance (MMR) for diversity
- Graph-aware context expansion (related imports added to LLM context)
- Grounded LLM responses with inline `[Source N]` citations

### LangGraph Agent Orchestration
- StateGraph with 4 nodes: planner → retriever → reasoner → summarizer
- Iterative evidence gathering with up to 3 reasoning cycles
- Adaptive replanning when evidence is insufficient
- Self-correction and contradiction detection
- Persistent reasoning memory (discovered facts + searched queries)

### Repository Graph Engine
- Static analysis across all ingested files
- Extracts imports, function definitions, and call relationships
- 3D interactive visualisation (Z-axis = complexity, colored by directory)

### Production Infrastructure
- API key authentication middleware (`X-API-Key` header)
- Pydantic-settings config with `.env` support
- Docker Compose stack: FastAPI + Streamlit + PostgreSQL/pgvector
- GitHub Actions CI: lint (ruff) + pytest with coverage
- 42 unit tests across all core services

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | FastAPI + Uvicorn |
| **Frontend** | Streamlit |
| **LLM** | Ollama (`qwen2.5-coder:7b`) — runs locally |
| **Agent Orchestration** | LangGraph (StateGraph) |
| **Vector Store** | PostgreSQL + pgvector via LangChain |
| **Embeddings** | sentence-transformers (`all-MiniLM-L6-v2`) |
| **Reranking** | cross-encoder (`ms-marco-MiniLM-L-6-v2`) |
| **Code Parsing** | tree-sitter + tree-sitter-language-pack |
| **BM25 Search** | rank-bm25 |
| **Containerisation** | Docker + Docker Compose |
| **CI** | GitHub Actions |

## Project Structure

```
app/
├── agents/
│   ├── coordinator.py       # LangGraph StateGraph orchestrator
│   ├── state.py             # AgentState TypedDict
│   ├── planner_agent.py     # Query decomposition and replanning
│   ├── retriever_agent.py   # Tool-use retrieval (semantic + keyword)
│   ├── reasoner_agent.py    # Evidence critique and reflection
│   └── summarizer_agent.py  # Final grounded answer synthesis
├── core/
│   └── config.py            # pydantic-settings BaseSettings
├── middleware/
│   └── auth.py              # API key middleware
├── routes/
│   ├── repo.py              # Ingest endpoint
│   ├── rag.py               # RAG query endpoint
│   ├── agent.py             # Agent query endpoint
│   ├── architecture.py      # Architecture summary endpoint
│   ├── onboarding.py        # Onboarding guide endpoint
│   ├── graph.py             # Repository graph endpoint
│   ├── flow.py              # Flow trace endpoint
│   └── search.py            # Direct semantic search
├── services/
│   ├── vector_db_service.py      # LangChain PGVector (store + search)
│   ├── hybrid_retrieval_service.py  # BM25 + semantic + RRF
│   ├── reranking_service.py      # Cross-encoder, MMR, deduplication
│   ├── rag_service.py            # Full RAG pipeline
│   ├── chunking_service.py       # Tree-sitter multi-language parser
│   ├── embedding_service.py      # Sentence-transformer embeddings
│   ├── llm_service.py            # Ollama client wrapper
│   ├── repo_service.py           # Git clone + ingest orchestration
│   ├── architecture_service.py   # LLM-based architecture summary
│   ├── onboarding_service.py     # Onboarding guide generator
│   └── graph_retrieval_service.py  # Graph-aware context expansion
├── storage/
│   ├── repository_graph.py  # In-memory dependency graph
│   └── chunk_store.py       # In-memory BM25 corpus
tests/
├── conftest.py
├── test_chunking_service.py
├── test_hybrid_retrieval.py
├── test_reranking_service.py
├── test_rag_service.py
└── test_auth_middleware.py
Dockerfile
Dockerfile.streamlit
docker-compose.yml
streamlit_app.py
```

## Quick Start (Docker — recommended)

**Prerequisites:** Docker Desktop, Ollama running locally with the model pulled.

```bash
ollama pull qwen2.5-coder:7b
```

```bash
git clone https://github.com/your-username/repograph-ai
cd repograph-ai
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---|---|
| Streamlit UI | http://localhost:8501 |
| API docs (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5433 |

> **Note:** If port 5432 is already in use by a local PostgreSQL instance, the compose file maps the container to host port 5433.

## Quick Start (Local)

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL with pgvector (Docker one-liner)
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=repograph \
  -e POSTGRES_PASSWORD=repograph \
  -e POSTGRES_DB=repograph \
  ankane/pgvector

ollama pull qwen2.5-coder:7b
uvicorn app.main:app --reload
streamlit run streamlit_app.py
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/ingest-repo` | Yes | Clone and index a GitHub repository |
| POST | `/rag-query` | Yes | Ask a question grounded in the repository |
| POST | `/agent-query` | Yes | Autonomous multi-step repository analysis |
| GET | `/architecture-summary` | Yes | LLM-generated architecture overview |
| GET | `/onboarding-guide` | Yes | Developer onboarding guide |
| GET | `/repository-graph` | Yes | Full in-memory dependency graph (JSON) |
| GET | `/trace-flow` | Yes | Trace call chains matching a keyword |
| POST | `/search` | Yes | Direct semantic search over indexed chunks |

All authenticated endpoints require the `X-API-Key` header. Default key: `changeme-dev-key` (set `API_KEY` in `.env`).

## Authentication

```bash
curl http://localhost:8000/rag-query \
  -H "X-API-Key: changeme-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"query": "How does the embedding pipeline work?"}'
```

## Streamlit UI Tabs

| Tab | Description |
|---|---|
| **Ingest** | Enter a GitHub URL to clone and index a repository |
| **RAG Query** | Ask questions — get grounded answers with source citations |
| **Agent** | Run the LangGraph agent with full reasoning trace |
| **Graph** | 3D rotating dependency graph (Z = complexity) |
| **Architecture** | Auto-generated architecture summary |
| **Onboarding** | New-developer onboarding guide with entry points |
| **Flow Trace** | Trace a function keyword through the call graph |

## Configuration

Copy `.env.example` to `.env` and adjust:

```env
DATABASE_URL=postgresql+psycopg2://repograph:repograph@localhost:5432/repograph
OLLAMA_MODEL=qwen2.5-coder:7b
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIM=384
API_KEY=changeme-dev-key
REPO_BASE_PATH=repositories
```

## Running Tests

```bash
pytest tests/ -v --cov=app
```

42 tests covering chunking, hybrid retrieval, reranking, RAG pipeline, and auth middleware. All external dependencies (Ollama, PostgreSQL, HuggingFace models) are mocked.
