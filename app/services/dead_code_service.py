"""Dead code detection — functions with no incoming CALLS edges in Neo4j."""
from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import _get_latest_repo, _to_relative_path


def _to_symbols(rows: list[dict]) -> list[dict]:
    """Flatten Neo4j rows into the flat symbol list the UI renders."""
    symbols = []
    for r in rows:
        rel = _to_relative_path(r.get("file_path", "unknown"))
        symbols.append({
            "symbol":   r["name"],
            "file":     rel.split("/")[-1],
            "rel_path": rel,
            "line":     r.get("line") or 0,
            "callers":  0,  # dead code by definition has zero incoming calls
        })
    # Sort by file then symbol for stable display.
    return sorted(symbols, key=lambda s: (s["file"], s["symbol"]))


def analyze_dead_code(repo_id: str | None = None) -> dict:
    user_id = get_user_id()
    if not repo_id:
        repo = _get_latest_repo(user_id)
        if not repo:
            return {
                "total": 0,
                "symbols": [],
                "message": "No repository data found. Please analyze a repository first.",
            }
        repo_id = repo["repo_id"]

    from app.db.neo4j import get_dead_functions
    dead = get_dead_functions(user_id, repo_id)

    if not dead:
        return {
            "total": 0,
            "symbols": [],
            "message": "No unreferenced functions detected — graph may still be building, or re-analyze to populate Neo4j.",
        }

    symbols = _to_symbols(dead)
    return {
        "total": len(symbols),
        "symbols": symbols,
        "message": f"{len(symbols)} symbols have zero incoming calls in the graph — candidates for removal.",
    }
