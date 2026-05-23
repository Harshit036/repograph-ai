from fastapi import APIRouter
from pydantic import BaseModel

from app.services.rag_service import generate_rag_response

router = APIRouter()


class RagRequest(BaseModel):
    query: str


@router.post("/rag-query")
def rag_query(request: RagRequest):

    response = generate_rag_response(request.query)

    return response
