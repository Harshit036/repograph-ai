from fastapi import APIRouter
from pydantic import BaseModel

from app.services.repo_service import clone_repository, scan_repository, cleanup_repository
from app.services.graph_service import build_repository_graph
from app.storage.repository_graph import repository_graph
from app.storage.chunk_store import chunk_store

router = APIRouter()


class RepoRequest(BaseModel):
    repo_url: str


@router.post("/ingest-repo")
def ingest_repo(request: RepoRequest):
    repo_path, is_temp = clone_repository(request.repo_url)
    try:
        chunk_store.clear()
        repository_graph.clear()
        repository_data = scan_repository(repo_path)
        repository_graph.update(build_repository_graph(repository_data))
    finally:
        if is_temp:
            cleanup_repository(repo_path)

    return {
        "total_files": len(repository_data),
        "files": [
            {"file_name": f["file_name"], "total_chunks": len(f["chunks"])}
            for f in repository_data
        ],
    }
