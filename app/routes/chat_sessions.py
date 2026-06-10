from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.user_context import get_user_id
from app.db.migrations import (
    get_chat_sessions, create_chat_session, delete_chat_session,
    get_session_messages, save_session_message, update_session_title,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    title: str = ""
    repo_ids: list[str] = []


class SaveMessageRequest(BaseModel):
    role: str
    content: str
    citations: list | None = None
    actions: list | None = None


class UpdateTitleRequest(BaseModel):
    title: str


@router.get("")
def list_sessions():
    return get_chat_sessions(get_settings().database_url, get_user_id())


@router.post("")
def create_session(req: CreateSessionRequest):
    result = create_chat_session(get_settings().database_url, get_user_id(), req.title, req.repo_ids)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create session")
    return result


@router.delete("/{session_id}")
def delete_session(session_id: str):
    delete_chat_session(get_settings().database_url, session_id, get_user_id())
    return {"deleted": True}


@router.patch("/{session_id}/title")
def rename_session(session_id: str, req: UpdateTitleRequest):
    update_session_title(get_settings().database_url, session_id, get_user_id(), req.title)
    return {"updated": True}


@router.get("/{session_id}/messages")
def get_messages(session_id: str):
    return get_session_messages(get_settings().database_url, session_id, get_user_id())


@router.post("/{session_id}/messages")
def post_message(session_id: str, req: SaveMessageRequest):
    result = save_session_message(
        get_settings().database_url, session_id,
        req.role, req.content, req.citations, req.actions,
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to save message")
    return result
