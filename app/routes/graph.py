from fastapi import APIRouter
from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import get_active_graph, get_active_repo_id
from app.db.neo4j import get_graph_for_summary

router = APIRouter()


@router.get("/repository-graph")
def get_graph_route():
    """Return graph dict for Plotly visualisation.

    Tries Neo4j first (higher node limit for richer visualisation), then falls
    back to the JSONB snapshot for repos ingested before the Neo4j migration.
    """
    user_id = get_user_id()
    repo_id = get_active_repo_id(user_id)
    if repo_id:
        graph = get_graph_for_summary(user_id, repo_id, limit=200)
        if graph:
            return graph
    return get_active_graph(user_id, limit=200)
