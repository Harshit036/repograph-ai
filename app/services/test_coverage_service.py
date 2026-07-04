"""Graph-estimated test coverage — how much of the hot path is reached by tests.

This is an ESTIMATE from the call graph, not executed-line coverage. For each of
the most-called production functions we compute the share of its callers that are
test functions.
"""
from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import _get_latest_repo, _to_relative_path


def _to_rows(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        total = r.get("total_callers", 0) or 0
        tested = r.get("test_callers", 0) or 0
        coverage = round(100 * tested / total) if total else 0
        rel = _to_relative_path(r.get("file_path", "unknown"))
        out.append({
            "name":     r["name"],
            "file":     rel.split("/")[-1],
            "rel_path": rel,
            "line":     r.get("line") or 0,
            "coverage": coverage,
            "tested":   coverage >= 80,
            "test_callers":  tested,
            "total_callers": total,
        })
    return out


def analyze_test_coverage(repo_id: str | None = None) -> dict:
    user_id = get_user_id()
    if not repo_id:
        repo = _get_latest_repo(user_id)
        if not repo:
            return {
                "total": 0,
                "untested": 0,
                "functions": [],
                "message": "No repository data found. Please analyze a repository first.",
            }
        repo_id = repo["repo_id"]

    from app.db.neo4j import get_function_coverage
    rows = get_function_coverage(user_id, repo_id, limit=15)

    if not rows:
        return {
            "total": 0,
            "untested": 0,
            "functions": [],
            "message": "No call-graph data yet — graph may still be building, or re-analyze to populate Neo4j.",
        }

    functions = _to_rows(rows)
    untested = sum(1 for f in functions if f["coverage"] == 0)
    return {
        "total": len(functions),
        "untested": untested,
        "functions": functions,
        "message": f"Graph-estimated coverage across the {len(functions)} most-called functions. {untested} hot function(s) have no tests.",
    }
