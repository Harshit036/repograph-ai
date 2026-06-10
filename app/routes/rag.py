from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.rag_service import generate_rag_response, stream_rag_response

router = APIRouter()


class HistoryMessage(BaseModel):
    role: str
    content: str


class RagRequest(BaseModel):
    query: str
    messages: list[HistoryMessage] = []
    repo_ids: list[str] = []       # empty = all repos for this user


@router.post("/rag-query")
def rag_query(request: RagRequest):
    history = [m.model_dump() for m in request.messages]
    return generate_rag_response(request.query, history, repo_ids=request.repo_ids or None)


@router.post("/rag-query/stream")
def rag_query_stream(request: RagRequest):
    history = [m.model_dump() for m in request.messages]
    return StreamingResponse(
        stream_rag_response(request.query, history, repo_ids=request.repo_ids or None),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
