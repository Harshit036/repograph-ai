# RepoGraph AI

An autonomous repository intelligence platform that combines semantic search, graph-based code reasoning, and agentic planning to answer deep questions about any codebase.

## Features

### Data Pipeline
- Clone and ingest GitHub repositories
- AST-based semantic chunking for Python (functions and classes as discrete units)
- Embedding generation via `sentence-transformers` (`all-MiniLM-L6-v2`)
- Persistent vector storage in ChromaDB

### Retrieval & RAG
- Semantic similarity search over repository chunks
- RAG pipeline: retrieval → deduplication → word-overlap reranking → grounded LLM response
- Graph-aware context expansion (imports of matched files are added to context)

### Repository Graph Engine
- Static analysis of Python files using AST
- Extracts imports, function definitions, and call relationships (including method calls)
- In-memory graph updated on every ingestion

### Agentic Analysis
- ReAct-style agent: plan → tool use → reflect → replan
- Tools: semantic search, keyword search
- Up to 3 reasoning iterations with early stopping on sufficient evidence
- Adaptive replanning when evidence is weak

### Flow Tracing
- Trace function call chains across the repository graph
- Search by keyword to find where a function is defined and what it calls

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingest-repo` | Clone and index a GitHub repository |
| POST | `/rag-query` | Ask a question grounded in the repository |
| POST | `/search` | Direct semantic search over indexed chunks |
| POST | `/agent-query` | Autonomous multi-step repository analysis |
| GET | `/repository-graph` | Return the full in-memory dependency graph |
| GET | `/trace-flow` | Trace call chains matching a keyword |
| POST | `/chat` | General LLM chat |

## Tech Stack

- **Framework:** FastAPI + Uvicorn
- **LLM:** Ollama (`qwen2.5-coder:7b`) — runs locally
- **Embeddings:** sentence-transformers (`all-MiniLM-L6-v2`)
- **Vector DB:** ChromaDB (persistent, local)
- **Code Analysis:** Python `ast` module
- **Repo Cloning:** GitPython

## Project Structure

```
app/
  routes/          # API endpoint handlers
  services/        # Business logic (RAG, graph, embeddings, chunking, flow tracing)
  agents/          # ReAct agent with tool use, planning, and reflection
  storage/         # In-memory repository graph
chroma_db/         # Persistent vector database
repositories/      # Cloned repositories
```

## Getting Started

```bash
pip install -r requirements.txt
ollama pull qwen2.5-coder:7b
uvicorn app.main:app --reload
```

Then ingest a repository:
```bash
curl -X POST http://localhost:8000/ingest-repo \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your/repo"}'
```

## Roadmap

- [ ] Day 16: Architecture summarization
- [ ] Day 17: Onboarding guide generator
- [ ] Day 18: Q&A with citations
- [ ] Day 19: Hybrid retrieval (semantic + BM25 + metadata)
- [ ] Day 20: Neural reranking (cross-encoder)
- [ ] Day 21: Semantic deduplication + MMR
- [ ] Day 22: Reasoning memory
- [ ] Day 23: Reflection and self-correction
- [ ] Day 24: Multi-agent architecture
- [ ] Day 25: Frontend + observability
