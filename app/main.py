from fastapi import FastAPI
from app.routes.chat import router as chat_router
from app.routes.repo import router as repo_router
from app.routes.search import router as search_router

app = FastAPI(title="RepoGraph AI")

app.include_router(chat_router)
app.include_router(repo_router)
app.include_router(search_router)
