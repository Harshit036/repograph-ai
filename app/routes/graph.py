from fastapi import APIRouter
from app.core.user_context import get_user_id
from app.storage.user_stores import get_graph

router = APIRouter()


@router.get("/repository-graph")
def get_graph_route():
    return get_graph(get_user_id())
