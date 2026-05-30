from fastapi import APIRouter
from app.storage.repository_graph import repository_graph
from app.storage.chunk_store import chunk_store

router = APIRouter()


@router.get("/stats")
def get_stats():
    files_count = len(repository_graph)
    chunks_count = len(chunk_store)

    repos = set()
    for path in repository_graph:
        parts = path.replace("\\", "/").split("/")
        if "repositories" in parts:
            idx = parts.index("repositories")
            if idx + 1 < len(parts):
                repos.add(parts[idx + 1])

    functions_count = sum(
        len(node.get("functions", [])) for node in repository_graph.values()
    )

    return {
        "repos": len(repos),
        "files": files_count,
        "chunks": chunks_count,
        "functions": functions_count,
    }
