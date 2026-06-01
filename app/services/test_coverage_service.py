"""Test coverage mapping — production functions not called by any test function."""
import os
from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import _get_latest_repo


def _group_by_file(rows: list[dict]) -> list[dict]:
    by_file: dict = {}
    for r in rows:
        fp = r.get("file_path", "unknown")
        by_file.setdefault(fp, []).append({
            "name": r["name"],
            "line": r.get("line") or 0,
        })
    return [
        {"file": os.path.relpath(fp) if fp != "unknown" else fp, "functions": fns}
        for fp, fns in sorted(by_file.items())
    ]


def analyze_test_coverage(repo_id: str | None = None) -> dict:
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

    from app.db.neo4j import get_untested_functions
    untested = get_untested_functions(user_id, repo_id)

    if not untested:
        return {
            "total": 0,
            "by_file": [],
            "message": "No untested functions detected — graph may still be building, or re-analyze to populate Neo4j.",
        }

    return {
        "total": len(untested),
        "by_file": _group_by_file(untested),
        "message": f"{len(untested)} function(s) appear to have no test coverage.",
    }
