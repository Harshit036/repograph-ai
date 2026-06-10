from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from app.core.config import get_settings
from app.core.user_context import get_user_id
from app.db.migrations import get_repo_file_tree, get_repo_file_content
from app.services.graph_retrieval_service import get_active_repo_id

router = APIRouter()


def _resolve_repo_id(repo_id: Optional[str]) -> tuple[str, str]:
    user_id = get_user_id()
    rid = repo_id or get_active_repo_id(user_id)
    if not rid:
        raise HTTPException(status_code=404, detail="No active repository found.")
    return user_id, rid


@router.get("/files")
def file_tree(repo_id: Optional[str] = Query(None)):
    """Return the file tree [{file_path, language, size}] for the active repo."""
    user_id, rid = _resolve_repo_id(repo_id)
    return get_repo_file_tree(get_settings().database_url, user_id, rid)


@router.get("/file")
def file_content(path: str = Query(...), repo_id: Optional[str] = Query(None)):
    """Return {content, language} for a single file."""
    user_id, rid = _resolve_repo_id(repo_id)
    result = get_repo_file_content(get_settings().database_url, user_id, rid, path)
    if not result:
        raise HTTPException(status_code=404, detail="File not found.")
    return result
