from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.coordinator import run


router = APIRouter()


class AgentRequest(BaseModel):
    query: str


@router.post("/agent-query")
def agent_query(request: AgentRequest):
    return run(request.query)
