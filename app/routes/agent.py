from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.repository_agent import repository_agent

router = APIRouter()


class AgentRequest(BaseModel):
    query: str


@router.post("/agent-query")
def agent_query(request: AgentRequest):

    result = repository_agent(request.query)

    return result
