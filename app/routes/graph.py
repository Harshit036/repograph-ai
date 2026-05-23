from fastapi import APIRouter

from app.storage.repository_graph import repository_graph

router = APIRouter()


@router.get("/repository-graph")
def get_graph():
    return repository_graph
