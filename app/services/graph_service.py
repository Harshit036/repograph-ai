"""Repository graph builder — Phase 4 of the knowledge pipeline.

Uses Python's ast module for Python files (most reliable for call/import
resolution) and Tree-sitter via graph_extractors for JS/TS/Go.

Returns a dict that is both written to Neo4j (via write_graph_to_neo4j) and
used as a lightweight in-memory structure for backward-compat callers.
"""
import ast
import os

_PYTHON_EXTS = {".py"}
_JS_TS_EXTS  = {".js", ".jsx", ".ts", ".tsx"}
_GO_EXTS     = {".go"}


def _extract_python(file_path: str, content: str) -> dict:
    data: dict = {
        "language": "python",
        "imports": [],
        "functions": [],
        "classes": [],
        "calls": {},
    }
    try:
        tree = ast.parse(content)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    data["imports"].append(alias.name)

            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    data["imports"].append(node.module)

            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                data["functions"].append({
                    "name": node.name,
                    "start_line": node.lineno,
                    "end_line": getattr(node, "end_lineno", node.lineno),
                })
                calls: list[str] = []
                for child in ast.walk(node):
                    if isinstance(child, ast.Call):
                        if isinstance(child.func, ast.Name):
                            calls.append(child.func.id)
                        elif isinstance(child.func, ast.Attribute):
                            calls.append(child.func.attr)
                data["calls"][node.name] = calls

            elif isinstance(node, ast.ClassDef):
                parents = []
                for base in node.bases:
                    if isinstance(base, ast.Name):
                        parents.append(base.id)
                    elif isinstance(base, ast.Attribute):
                        parents.append(base.attr)
                data["classes"].append({"name": node.name, "parents": parents})
    except Exception:
        pass
    return data


def build_repository_graph(repository_data: list) -> dict:
    """Extract graph entities from all repo files.

    Returns a dict keyed by file_path. Each value carries:
        language, imports, functions (list of {name, start_line, end_line}),
        classes (list of {name, parents}), calls ({fn_name: [callee, ...]}).
    """
    from app.services.graph_extractors import extract_js_ts, extract_go

    graph: dict = {}
    for file in repository_data:
        file_path = file["file_path"]
        content   = file.get("content", "")
        ext       = os.path.splitext(file_path)[1].lower()

        if ext in _PYTHON_EXTS:
            data = _extract_python(file_path, content)
        elif ext in _JS_TS_EXTS:
            data = extract_js_ts(file_path, content, ext)
        elif ext in _GO_EXTS:
            data = extract_go(file_path, content)
        else:
            data = {"language": "other", "imports": [], "functions": [], "classes": [], "calls": {}}

        graph[file_path] = data

    return graph


def write_graph_to_neo4j(user_id: str, repo_id: str, graph: dict) -> None:
    """Persist the graph to Neo4j. Errors are logged but never raise."""
    from app.db.neo4j import bulk_write_graph
    try:
        bulk_write_graph(user_id, repo_id, graph)
    except Exception as e:
        print(f"Neo4j write skipped: {e}")
