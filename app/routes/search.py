from fastapi import APIRouter
from pydantic import BaseModel

from app.services.embedding_service import generate_embedding

from app.services.vector_db_service import search_similar_chunks

router = APIRouter()


class SearchRequest(BaseModel):
    query: str


@router.post("/search")
def search(request: SearchRequest):

    query_embedding = generate_embedding(request.query)

    results = search_similar_chunks(query_embedding)

    return results
