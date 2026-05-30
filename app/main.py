from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.middleware.auth import APIKeyMiddleware
from app.routes.chat import router as chat_router
from app.routes.repo import router as repo_router
from app.routes.search import router as search_router
from app.routes.rag import router as rag_router
from app.routes.agent import router as agent_router
from app.routes.graph import router as graph_router
from app.routes.flow import router as flow_router
from app.routes.architecture import router as architecture_router
from app.routes.onboarding import router as onboarding_router
from app.routes.stats import router as stats_router
from app.routes.tree import router as tree_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.vector_db_service import init_db
    from app.db.migrations import run_migrations
    from app.core.config import get_settings
    init_db()
    run_migrations(get_settings().database_url)
    yield


app = FastAPI(title="RepoGraph AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(APIKeyMiddleware)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


app.include_router(chat_router)
app.include_router(repo_router)
app.include_router(search_router)
app.include_router(rag_router)
app.include_router(agent_router)
app.include_router(graph_router)
app.include_router(flow_router)
app.include_router(architecture_router)
app.include_router(onboarding_router)
app.include_router(stats_router)
app.include_router(tree_router)
