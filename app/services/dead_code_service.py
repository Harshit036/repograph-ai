"""Dead code detection — functions with no incoming CALLS edges in Neo4j."""
from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import _get_latest_repo, _to_relative_path


def _group_by_file(rows: list[dict]) -> list[dict]:
    by_file: dict = {}
    for r in rows:
        fp = r.get("file_path", "unknown")
        by_file.setdefault(fp, []).append({
            "name": r["name"],
            "line": r.get("line") or 0,
        })
    return [
        {"file": _to_relative_path(fp), "functions": fns}
        for fp, fns in sorted(by_file.items())
    ]


def analyze_dead_code(repo_id: str | None = None) -> dict:
    user_id = get_user_id()
    if not repo_id:
        repo = _get_latest_repo(user_id)
        if not repo:
            return {
                "total": 0,
                "by_file": [],
                "message": "No repository data found. Please analyze a repository first.",
            }
        repo_id = repo["repo_id"]

    from app.db.neo4j import get_dead_functions
    dead = get_dead_functions(user_id, repo_id)

    if not dead:
        return {
            "total": 0,
            "by_file": [],
            "message": "No unreferenced functions detected — graph may still be building, or re-analyze to populate Neo4j.",
        }

    return {
        "total": len(dead),
        "by_file": _group_by_file(dead),
        "message": f"Found {len(dead)} potentially unreferenced function(s) across {len(_group_by_file(dead))} file(s).",
    }
