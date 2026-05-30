from fastapi import APIRouter
from app.core.user_context import get_user_id
from app.storage.user_stores import get_graph, get_chunks

router = APIRouter()


@router.get("/stats")
def get_stats():
    user_id = get_user_id()
    graph   = get_graph(user_id)
    chunks  = get_chunks(user_id)

    repos = set()
    for path in graph:
        parts = path.replace("\\", "/").split("/")
        if "repositories" in parts:
            idx = parts.index("repositories")
            if idx + 1 < len(parts):
                repos.add(parts[idx + 1])

    return {
        "repos":     len(repos),
        "files":     len(graph),
        "chunks":    len(chunks),
        "functions": sum(len(n.get("functions", [])) for n in graph.values()),
    }
