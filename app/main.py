import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.middleware.auth import APIKeyMiddleware
from app.routes.repo import router as repo_router
from app.routes.search import router as search_router
from app.routes.rag import router as rag_router
from app.routes.agent import router as agent_router
from app.routes.graph import router as graph_router
from app.routes.flow import router as flow_router
from app.routes.architecture import router as architecture_router
from app.routes.onboarding import router as onboarding_router
from app.routes.stats import router as stats_router
from app.routes.analysis import router as analysis_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.vector_db_service import init_db
    from app.db.migrations import run_migrations
    from app.db.neo4j import create_indexes
    from app.core.config import get_settings
    init_db()
    run_migrations(get_settings().database_url)
    create_indexes()
    yield


app = FastAPI(title="RepoGraph AI", lifespan=lifespan)

_cors_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(APIKeyMiddleware)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


@app.get("/ollama/models", tags=["llm"])
def ollama_models():
    """Proxy Ollama /api/tags so the frontend can discover local models without CORS issues."""
    import httpx
    from app.core.config import get_settings
    settings = get_settings()
    try:
        resp = httpx.get(f"{settings.ollama_base_url}/api/tags", timeout=5)
        resp.raise_for_status()
        names = [m["name"] for m in resp.json().get("models", [])]
        return {"models": names}
    except Exception:
        return {"models": []}


app.include_router(repo_router)
app.include_router(search_router)
app.include_router(rag_router)
app.include_router(agent_router)
app.include_router(graph_router)
app.include_router(flow_router)
app.include_router(architecture_router)
app.include_router(onboarding_router)
app.include_router(stats_router)
app.include_router(analysis_router)
