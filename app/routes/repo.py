from fastapi import APIRouter
from pydantic import BaseModel

from app.services.repo_service import clone_repository, scan_repository
from app.services.graph_service import build_repository_graph
from app.storage.repository_graph import repository_graph
from app.storage.chunk_store import chunk_store

router = APIRouter()


class RepoRequest(BaseModel):
    repo_url: str


@router.post("/ingest-repo")
def ingest_repo(request: RepoRequest):
    repo_path = clone_repository(request.repo_url)
    chunk_store.clear()
    repository_graph.clear()
    repository_data = scan_repository(repo_path)
    repository_graph.update(build_repository_graph(repository_data))

    return {
        "total_files": len(repository_data),
        "files": [
            {"file_name": file["file_name"], "total_chunks": len(file["chunks"])}
            for file in repository_data[:5]
        ],
    }
