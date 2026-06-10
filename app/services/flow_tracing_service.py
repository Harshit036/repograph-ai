"""Flow tracer — BFS over Neo4j CALLS edges to build an interactive call graph."""

from app.core.user_context import get_user_id
from app.services.graph_retrieval_service import _get_latest_repo, _to_relative_path


def _make_id(name: str, file_path: str) -> str:
    return f"{name}::{file_path}"


def _build_subgraph(session, uid: str, rid: str, kw: str, direction: str, max_depth: int) -> dict:
    """
    Single-query approach: collect the whole reachable subgraph in one Cypher round-trip,
    then reconstruct nodes/edges/roots in Python.

    direction='callees': starting functions → what they call (tree expands downward)
    direction='callers': starting functions → who calls them (tree shows callers as children)
    """
    # --- 1. Find starting functions ---
    start_result = session.run(
        """
        MATCH (f:Function {user_id: $uid, repo_id: $rid})
        WHERE toLower(f.name) CONTAINS $kw
          AND f.file_path IS NOT NULL AND f.file_path <> 'unknown'
        RETURN f.name AS name, f.file_path AS file_path, coalesce(f.start_line, 0) AS line
        LIMIT 3
        """,
        uid=uid, rid=rid, kw=kw.lower(),
    )
    starts = [dict(r) for r in start_result]
    if not starts:
        return {"keyword": kw, "direction": direction, "nodes": [], "edges": [], "roots": [], "total": 0}

    # --- 2. Expand the subgraph and collect edges (one query) ---
    depth_str = str(max_depth)
    if direction == "callees":
        # Expand by following CALLS forward; tree edges = caller→callee
        subgraph_query = f"""
            MATCH (start:Function {{user_id: $uid, repo_id: $rid}})
            WHERE toLower(start.name) CONTAINS $kw
              AND start.file_path IS NOT NULL AND start.file_path <> 'unknown'
            WITH collect(start)[..3] AS starts

            UNWIND starts AS start
            OPTIONAL MATCH (start)-[:CALLS*1..{depth_str}]->(fn:Function {{user_id: $uid, repo_id: $rid}})
            WHERE fn.file_path IS NOT NULL AND fn.file_path <> 'unknown'

            WITH collect(DISTINCT fn) + starts AS all_fns, starts

            UNWIND all_fns AS from_fn
            OPTIONAL MATCH (from_fn)-[:CALLS]->(to_fn:Function {{user_id: $uid, repo_id: $rid}})
            WHERE to_fn IN all_fns AND to_fn.file_path IS NOT NULL

            RETURN DISTINCT
                from_fn.name AS from_name, from_fn.file_path AS from_fp,
                coalesce(from_fn.start_line, 0) AS from_line,
                to_fn.name AS to_name, to_fn.file_path AS to_fp,
                coalesce(to_fn.start_line, 0) AS to_line,
                from_fn IN starts AS is_root
            ORDER BY is_root DESC
            LIMIT 120
        """
    else:
        # Expand by following CALLS backward; tree edges = target→caller
        subgraph_query = f"""
            MATCH (start:Function {{user_id: $uid, repo_id: $rid}})
            WHERE toLower(start.name) CONTAINS $kw
              AND start.file_path IS NOT NULL AND start.file_path <> 'unknown'
            WITH collect(start)[..3] AS starts

            UNWIND starts AS start
            OPTIONAL MATCH (caller:Function {{user_id: $uid, repo_id: $rid}})-[:CALLS*1..{depth_str}]->(start)
            WHERE caller.file_path IS NOT NULL AND caller.file_path <> 'unknown'

            WITH collect(DISTINCT caller) + starts AS all_fns, starts

            UNWIND all_fns AS fn
            OPTIONAL MATCH (fn)<-[:CALLS]-(parent_fn:Function {{user_id: $uid, repo_id: $rid}})
            WHERE parent_fn IN all_fns AND parent_fn.file_path IS NOT NULL

            RETURN DISTINCT
                fn.name AS from_name, fn.file_path AS from_fp,
                coalesce(fn.start_line, 0) AS from_line,
                parent_fn.name AS to_name, parent_fn.file_path AS to_fp,
                coalesce(parent_fn.start_line, 0) AS to_line,
                fn IN starts AS is_root
            ORDER BY is_root DESC
            LIMIT 120
        """

    rows = list(session.run(subgraph_query, uid=uid, rid=rid, kw=kw.lower()))

    # --- 3. Reconstruct nodes + edges in Python ---
    nodes: dict[str, dict] = {}
    edge_set: set[tuple] = set()
    edges: list[dict] = []
    root_ids: list[str] = []

    def add_node(name, fp, line):
        if not name or not fp:
            return None
        nid = _make_id(name, fp)
        if nid not in nodes:
            nodes[nid] = {
                "id": nid, "name": name,
                "file_path": fp, "file": _to_relative_path(fp),
                "line": line or 0,
            }
        return nid

    for row in rows:
        from_id = add_node(row["from_name"], row["from_fp"], row["from_line"])
        if not from_id:
            continue
        if row["is_root"] and from_id not in root_ids:
            root_ids.append(from_id)

        to_name = row["to_name"]
        to_fp   = row["to_fp"]
        to_line = row["to_line"]
        if to_name and to_fp:
            to_id = add_node(to_name, to_fp, to_line)
            if to_id and (from_id, to_id) not in edge_set:
                edge_set.add((from_id, to_id))
                edges.append({"from": from_id, "to": to_id})

    # Ensure roots exist even if they have no outgoing edges (isolated or keyword-only)
    for s in starts:
        nid = add_node(s["name"], s["file_path"], s["line"])
        if nid and nid not in root_ids:
            root_ids.append(nid)

    return {
        "keyword":   kw,
        "direction": direction,
        "nodes":     list(nodes.values()),
        "edges":     edges,
        "roots":     root_ids,
        "total":     len(nodes),
    }


def trace_execution_flow(keyword: str, direction: str = "callees", max_depth: int = 4) -> dict:
    user_id = get_user_id()
    repo    = _get_latest_repo(user_id)
    if not repo:
        return {"keyword": keyword, "direction": direction, "nodes": [], "edges": [], "roots": [], "total": 0}

    try:
        from app.db.neo4j import get_driver
        with get_driver().session() as session:
            return _build_subgraph(session, user_id, repo["repo_id"], keyword, direction, max_depth)
    except Exception as e:
        print(f"trace_execution_flow error: {e}")
        return {"keyword": keyword, "direction": direction, "nodes": [], "edges": [], "roots": [], "total": 0}
