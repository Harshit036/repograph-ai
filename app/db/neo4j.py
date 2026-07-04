"""Neo4j driver and all graph CRUD / query helpers.

Graph schema
───────────
Nodes  :File, :Function, :Class, :Module
Edges  :IMPORTS (File→Module), :CALLS (Function→Function),
       :DEFINED_IN (Function/Class→File), :INHERITS (Class→Class)

All nodes carry user_id and repo_id so graphs are fully isolated per user+repo.
"""
import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)
_driver = None


# ── Driver lifecycle ────────────────────────────────────────────────────────────

def get_driver():
    global _driver
    if _driver is None:
        from neo4j import GraphDatabase
        s = get_settings()
        _driver = GraphDatabase.driver(s.neo4j_uri, auth=(s.neo4j_user, s.neo4j_password))
    return _driver


def close_driver():
    global _driver
    if _driver:
        _driver.close()
        _driver = None


def create_indexes() -> None:
    """Create composite indexes for fast per-user-repo lookups."""
    queries = [
        "CREATE INDEX file_user_repo IF NOT EXISTS FOR (n:File) ON (n.user_id, n.repo_id, n.path)",
        "CREATE INDEX func_user_repo IF NOT EXISTS FOR (n:Function) ON (n.user_id, n.repo_id, n.name)",
        "CREATE INDEX class_user_repo IF NOT EXISTS FOR (n:Class) ON (n.user_id, n.repo_id, n.name)",
        "CREATE INDEX module_user_repo IF NOT EXISTS FOR (n:Module) ON (n.user_id, n.repo_id, n.name)",
    ]
    try:
        with get_driver().session() as session:
            for q in queries:
                session.run(q)
        logger.info("Neo4j indexes ready")
    except Exception as e:
        logger.warning("Neo4j index creation failed: %s", e)


# ── Write ───────────────────────────────────────────────────────────────────────

def clear_repo_graph(user_id: str, repo_id: str) -> None:
    try:
        with get_driver().session() as session:
            session.run(
                "MATCH (n {user_id: $uid, repo_id: $rid}) DETACH DELETE n",
                uid=user_id, rid=repo_id,
            )
    except Exception as e:
        logger.warning("clear_repo_graph error: %s", e)


def bulk_write_graph(user_id: str, repo_id: str, graph: dict) -> None:
    """Batch-write a full repo graph to Neo4j (replaces any existing data)."""
    clear_repo_graph(user_id, repo_id)
    try:
        with get_driver().session() as session:
            # ── 1. File nodes ──────────────────────────────────────────────────
            files = [
                {"path": fp, "name": fp.split("/")[-1], "lang": d.get("language", "other")}
                for fp, d in graph.items()
            ]
            session.run(
                """
                UNWIND $files AS f
                MERGE (n:File {path: f.path, user_id: $uid, repo_id: $rid})
                SET n.name = f.name, n.language = f.lang
                """,
                files=files, uid=user_id, rid=repo_id,
            )

            # ── 2. Function nodes + DEFINED_IN edge ────────────────────────────
            functions = []
            for fp, d in graph.items():
                is_test = "test" in fp.lower() or "spec" in fp.lower()
                for fn in d.get("functions", []):
                    if isinstance(fn, str):
                        fn = {"name": fn, "start_line": 0, "end_line": 0}
                    functions.append({
                        "name": fn["name"],
                        "file_path": fp,
                        "start_line": fn.get("start_line", 0),
                        "end_line": fn.get("end_line", 0),
                        "is_test": is_test,
                    })
            if functions:
                session.run(
                    """
                    UNWIND $fns AS fn
                    MERGE (n:Function {name: fn.name, file_path: fn.file_path,
                                       user_id: $uid, repo_id: $rid})
                    SET n.start_line = fn.start_line, n.end_line = fn.end_line,
                        n.is_test = fn.is_test
                    WITH n, fn
                    MATCH (f:File {path: fn.file_path, user_id: $uid, repo_id: $rid})
                    MERGE (n)-[:DEFINED_IN]->(f)
                    """,
                    fns=functions, uid=user_id, rid=repo_id,
                )

            # ── 3. Class nodes ─────────────────────────────────────────────────
            classes = []
            inherits_data = []
            for fp, d in graph.items():
                for cls in d.get("classes", []):
                    if isinstance(cls, str):
                        cls = {"name": cls, "parents": []}
                    classes.append({"name": cls["name"], "file_path": fp})
                    for parent in cls.get("parents", []):
                        if parent:
                            inherits_data.append({
                                "child": cls["name"], "child_file": fp, "parent": parent,
                            })
            if classes:
                session.run(
                    """
                    UNWIND $cls AS c
                    MERGE (n:Class {name: c.name, file_path: c.file_path,
                                    user_id: $uid, repo_id: $rid})
                    WITH n, c
                    MATCH (f:File {path: c.file_path, user_id: $uid, repo_id: $rid})
                    MERGE (n)-[:DEFINED_IN]->(f)
                    """,
                    cls=classes, uid=user_id, rid=repo_id,
                )
            if inherits_data:
                session.run(
                    """
                    UNWIND $inh AS i
                    MATCH (child:Class {name: i.child, file_path: i.child_file,
                                        user_id: $uid, repo_id: $rid})
                    MERGE (parent:Class {name: i.parent, user_id: $uid, repo_id: $rid})
                      ON CREATE SET parent.file_path = "external"
                    MERGE (child)-[:INHERITS]->(parent)
                    """,
                    inh=inherits_data, uid=user_id, rid=repo_id,
                )

            # ── 4. IMPORTS edges (File → Module) ───────────────────────────────
            imports = [
                {"from_path": fp, "module": imp}
                for fp, d in graph.items()
                for imp in d.get("imports", [])
            ]
            if imports:
                session.run(
                    """
                    UNWIND $imports AS imp
                    MATCH (src:File {path: imp.from_path, user_id: $uid, repo_id: $rid})
                    MERGE (mod:Module {name: imp.module, user_id: $uid, repo_id: $rid})
                    MERGE (src)-[:IMPORTS]->(mod)
                    """,
                    imports=imports, uid=user_id, rid=repo_id,
                )

            # ── 5. CALLS edges (Function → Function) ───────────────────────────
            calls = [
                {"caller": caller, "caller_file": fp, "callee": callee}
                for fp, d in graph.items()
                for caller, callees in d.get("calls", {}).items()
                for callee in callees
            ]
            if calls:
                session.run(
                    """
                    UNWIND $calls AS c
                    MATCH (caller:Function {name: c.caller, file_path: c.caller_file,
                                            user_id: $uid, repo_id: $rid})
                    MERGE (callee:Function {name: c.callee, user_id: $uid, repo_id: $rid})
                      ON CREATE SET callee.file_path = "unknown", callee.is_test = false,
                                    callee.start_line = 0, callee.end_line = 0
                    MERGE (caller)-[:CALLS]->(callee)
                    """,
                    calls=calls, uid=user_id, rid=repo_id,
                )

        logger.info(
            "Neo4j graph written: user=%s repo=%s files=%d functions=%d",
            user_id, repo_id, len(files), len(functions),
        )
    except Exception as e:
        logger.error("bulk_write_graph failed: %s", e)


# ── Read ────────────────────────────────────────────────────────────────────────

def get_file_neighbors(user_id: str, repo_id: str, file_path: str, hops: int = 2) -> list[str]:
    """Return module names reachable via IMPORTS within `hops` steps."""
    try:
        with get_driver().session() as session:
            result = session.run(
                """
                MATCH (f:File {path: $fp, user_id: $uid, repo_id: $rid})
                      -[:IMPORTS*1..$hops]->(dep)
                RETURN DISTINCT dep.name AS name
                LIMIT 20
                """,
                fp=file_path, uid=user_id, rid=repo_id, hops=hops,
            )
            return [r["name"] for r in result if r["name"]]
    except Exception as e:
        logger.warning("get_file_neighbors error: %s", e)
        return []


def get_graph_for_summary(user_id: str, repo_id: str, limit: int = 20) -> dict:
    """Return {file_path: {functions: [str], imports: [str]}} for LLM prompts."""
    try:
        with get_driver().session() as session:
            result = session.run(
                """
                MATCH (f:File {user_id: $uid, repo_id: $rid})
                OPTIONAL MATCH (fn:Function)-[:DEFINED_IN]->(f)
                WITH f, collect(fn.name) AS funcs
                ORDER BY size(funcs) DESC
                LIMIT $lim
                OPTIONAL MATCH (f)-[:IMPORTS]->(m:Module)
                RETURN f.path AS path, funcs AS functions, collect(m.name) AS imports
                """,
                uid=user_id, rid=repo_id, lim=limit,
            )
            return {
                row["path"]: {"functions": row["functions"], "imports": row["imports"]}
                for row in result
                if row["path"]
            }
    except Exception as e:
        logger.warning("get_graph_for_summary error: %s", e)
        return {}


def count_repo_nodes(user_id: str, repo_id: str) -> int:
    """Return total number of graph nodes for this repo (0 = no graph built yet)."""
    try:
        with get_driver().session() as session:
            result = session.run(
                "MATCH (n {user_id: $uid, repo_id: $rid}) RETURN count(n) AS cnt",
                uid=user_id, rid=repo_id,
            )
            row = result.single()
            return row["cnt"] if row else 0
    except Exception as e:
        logger.warning("count_repo_nodes error: %s", e)
        return 0


def get_dead_functions(user_id: str, repo_id: str) -> list[dict]:
    """Functions in the repo with no incoming CALLS edges — potential dead code."""
    _SKIP = [
        "__init__", "__str__", "__repr__", "__len__", "__eq__", "__hash__",
        "__enter__", "__exit__", "main", "setUp", "tearDown",
    ]
    _SKIP_PATHS = [
        "node_modules", "/venv/", "/.venv/", "site-packages",
        "__pycache__", "/dist/", "/build/", "/vendor/", "/.tox/",
        ".egg-info", "/eggs/",
    ]
    try:
        with get_driver().session() as session:
            result = session.run(
                """
                MATCH (f:Function {user_id: $uid, repo_id: $rid})
                WHERE NOT f.is_test
                  AND f.file_path IS NOT NULL
                  AND f.file_path <> "unknown"
                  AND NOT ()-[:CALLS]->(f)
                  AND NOT f.name IN $skip
                  AND NOT any(p IN $skip_paths WHERE f.file_path CONTAINS p)
                RETURN f.name AS name, f.file_path AS file_path, f.start_line AS line
                ORDER BY f.file_path, f.name
                """,
                uid=user_id, rid=repo_id, skip=_SKIP, skip_paths=_SKIP_PATHS,
            )
            return [dict(r) for r in result]
    except Exception as e:
        logger.warning("get_dead_functions error: %s", e)
        return []


def get_function_coverage(user_id: str, repo_id: str, limit: int = 15) -> list[dict]:
    """Graph-estimated test coverage for the most-called ("hot") production functions.

    Coverage is estimated from the call graph, NOT executed-line coverage:
    for each function we count distinct callers and how many of them are test
    functions. Ranked by in-degree so the "hot path" surfaces first.
    """
    _SKIP_PATHS = [
        "node_modules", "/venv/", "/.venv/", "site-packages",
        "__pycache__", "/dist/", "/build/", "/vendor/", "/.tox/",
        ".egg-info", "/eggs/",
    ]
    try:
        with get_driver().session() as session:
            result = session.run(
                """
                MATCH (f:Function {user_id: $uid, repo_id: $rid})
                WHERE NOT f.is_test
                  AND f.file_path IS NOT NULL
                  AND f.file_path <> "unknown"
                  AND NOT any(p IN $skip_paths WHERE f.file_path CONTAINS p)
                OPTIONAL MATCH (caller:Function {user_id: $uid, repo_id: $rid})-[:CALLS]->(f)
                WITH f,
                     count(DISTINCT caller) AS total_callers,
                     count(DISTINCT CASE WHEN caller.is_test THEN caller END) AS test_callers
                WHERE total_callers > 0
                RETURN f.name AS name, f.file_path AS file_path, f.start_line AS line,
                       total_callers, test_callers
                ORDER BY total_callers DESC, f.name
                LIMIT $lim
                """,
                uid=user_id, rid=repo_id, skip_paths=_SKIP_PATHS, lim=limit,
            )
            return [dict(r) for r in result]
    except Exception as e:
        logger.warning("get_function_coverage error: %s", e)
        return []


def get_untested_functions(user_id: str, repo_id: str) -> list[dict]:
    """Production functions not called by any test function."""
    _SKIP_PATHS = [
        "node_modules", "/venv/", "/.venv/", "site-packages",
        "__pycache__", "/dist/", "/build/", "/vendor/", "/.tox/",
        ".egg-info", "/eggs/",
    ]
    try:
        with get_driver().session() as session:
            result = session.run(
                """
                MATCH (f:Function {user_id: $uid, repo_id: $rid})
                WHERE NOT f.is_test
                  AND f.file_path IS NOT NULL
                  AND f.file_path <> "unknown"
                  AND NOT (:Function {is_test: true, user_id: $uid, repo_id: $rid})-[:CALLS]->(f)
                  AND NOT any(p IN $skip_paths WHERE f.file_path CONTAINS p)
                RETURN f.name AS name, f.file_path AS file_path, f.start_line AS line
                ORDER BY f.file_path, f.name
                """,
                uid=user_id, rid=repo_id, skip_paths=_SKIP_PATHS,
            )
            return [dict(r) for r in result]
    except Exception as e:
        logger.warning("get_untested_functions error: %s", e)
        return []
