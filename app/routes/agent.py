from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.coordinator import run


router = APIRouter()


class HistoryMessage(BaseModel):
    role: str
    content: str


class AgentRequest(BaseModel):
    query: str
    messages: list[HistoryMessage] = []


@router.post("/agent-query")
def agent_query(request: AgentRequest):
    history = [m.model_dump() for m in request.messages]
    return run(request.query, history)
