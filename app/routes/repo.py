from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.user_context import get_user_id
from app.db.migrations import (
    delete_repo_embeddings, get_repo_entry, get_user_repos,
    upsert_repo_entry, upsert_user,
)
from app.services.graph_service import build_repository_graph
from app.services.repo_service import (
    cleanup_repository, clone_repository, get_remote_head_sha,
    repo_id_from_url, scan_repository,
)
from app.storage.user_stores import clear_user_repo, get_graph, set_graph

router = APIRouter()


class RepoRequest(BaseModel):
    repo_url: str
    # Optional user info forwarded from the frontend session
    github_login: str = ""
    avatar_url: str = ""


@router.post("/ingest-repo")
def ingest_repo(request: RepoRequest):
    user_id  = get_user_id()
    repo_url = request.repo_url.strip()
    rid      = repo_id_from_url(repo_url)
    settings = get_settings()

    # Persist user record (no-op if already exists)
    if request.github_login:
        upsert_user(settings.database_url, user_id, request.github_login, request.avatar_url)

    # Smart re-ingestion: check remote HEAD SHA before cloning
    remote_sha = get_remote_head_sha(repo_url)
    existing   = get_repo_entry(settings.database_url, user_id, rid)

    if existing and remote_sha and existing["commit_sha"] == remote_sha:
        return {
            "skipped":     True,
            "message":     "Repository is up to date — no new commits since last ingest.",
            "total_files": existing["file_count"],
            "files":       [],
        }

    # New commits (or first ingest): clear old data for this user+repo
    delete_repo_embeddings(settings.database_url, user_id, rid)
    clear_user_repo(user_id, rid)

    # Clone, scan, embed
    repo_path, is_temp = clone_repository(repo_url)
    try:
        repository_data = scan_repository(repo_path, user_id, rid, remote_sha or "")
        graph_data = build_repository_graph(repository_data)
        set_graph(user_id, {**get_graph(user_id), **graph_data})
    finally:
        if is_temp:
            cleanup_repository(repo_path)

    file_count  = len(repository_data)
    chunk_count = sum(len(f["chunks"]) for f in repository_data)

    upsert_repo_entry(
        settings.database_url, user_id, repo_url, rid,
        remote_sha or "", file_count, chunk_count,
    )

    return {
        "skipped":     False,
        "total_files": file_count,
        "files": [
            {"file_name": f["file_name"], "total_chunks": len(f["chunks"])}
            for f in repository_data
        ],
    }


@router.get("/my-repos")
def my_repos():
    user_id  = get_user_id()
    settings = get_settings()
    return get_user_repos(settings.database_url, user_id)
