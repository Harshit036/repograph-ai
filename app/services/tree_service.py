import os
from app.storage.repository_graph import repository_graph
from app.storage.chunk_store import chunk_store

# Colors by file extension (returned to frontend for consistent coloring)
EXT_COLOR = {
    ".py":   "#3b82f6",  # blue
    ".ts":   "#8b5cf6",  # violet
    ".tsx":  "#a78bfa",  # light violet
    ".js":   "#f59e0b",  # amber
    ".jsx":  "#fbbf24",  # yellow
    ".go":   "#10b981",  # emerald
    ".java": "#ef4444",  # red
    ".cpp":  "#f97316",  # orange
    ".c":    "#fb923c",  # light orange
    ".md":   "#6b7280",  # gray
}


def _chunk_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in chunk_store:
        fp = item.get("metadata", {}).get("file_path", "")
        if fp:
            counts[fp] = counts.get(fp, 0) + 1
    return counts


def build_tree() -> dict:
    """Build Plotly sunburst data from the in-memory repository graph."""
    if not repository_graph:
        return {}

    counts = _chunk_counts()
    paths  = list(repository_graph.keys())

    # Find the common root up to the 'repositories' segment
    def rel_parts(fp: str) -> list[str]:
        parts = fp.replace("\\", "/").split("/")
        if "repositories" in parts:
            idx = parts.index("repositories")
            return parts[idx:]       # e.g. ["repositories", "my-repo", "app", "foo.py"]
        return parts

    # Build node registry: id → {label, parent, value, ext, functions}
    nodes: dict[str, dict] = {}

    for file_path in paths:
        parts = rel_parts(file_path)
        func_count   = len(repository_graph[file_path].get("functions", []))
        chunk_count  = counts.get(file_path, 0)

        for depth, part in enumerate(parts):
            node_id   = "/".join(parts[: depth + 1])
            parent_id = "/".join(parts[:depth]) if depth > 0 else ""
            is_file   = (depth == len(parts) - 1)
            ext       = os.path.splitext(part)[1].lower() if is_file else ""

            if node_id not in nodes:
                nodes[node_id] = {
                    "label":      part,
                    "parent":     parent_id,
                    "value":      0,
                    "ext":        ext,
                    "is_file":    is_file,
                    "functions":  0,
                    "chunks":     0,
                }

            if is_file:
                nodes[node_id]["value"]     = max(1, chunk_count)
                nodes[node_id]["functions"] = func_count
                nodes[node_id]["chunks"]    = chunk_count

    # Propagate values upward so directories equal the sum of their children
    # Sort by depth descending so children are processed before parents
    sorted_ids = sorted(nodes.keys(), key=lambda x: x.count("/"), reverse=True)
    for node_id in sorted_ids:
        parent_id = nodes[node_id]["parent"]
        if parent_id and parent_id in nodes:
            nodes[parent_id]["value"] += nodes[node_id]["value"]

    ids         = list(nodes.keys())
    labels      = [nodes[n]["label"]                        for n in ids]
    parents     = [nodes[n]["parent"]                       for n in ids]
    values      = [nodes[n]["value"]                        for n in ids]
    extensions  = [nodes[n]["ext"]                          for n in ids]
    functions   = [nodes[n]["functions"]                    for n in ids]
    chunks      = [nodes[n]["chunks"]                       for n in ids]
    colors      = [EXT_COLOR.get(nodes[n]["ext"], "#52525b") for n in ids]
    is_file     = [nodes[n]["is_file"]                      for n in ids]

    return {
        "ids":        ids,
        "labels":     labels,
        "parents":    parents,
        "values":     values,
        "extensions": extensions,
        "functions":  functions,
        "chunks":     chunks,
        "colors":     colors,
        "is_file":    is_file,
    }
