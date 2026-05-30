"""Per-user scoped in-memory stores.

Replaces the old global chunk_store[] and repository_graph{}.
All services should call get_chunks(user_id) / get_graph(user_id) instead.
"""

_chunk_stores: dict[str, list] = {}   # user_id → [{"content": ..., "metadata": ...}]
_graphs: dict[str, dict] = {}          # user_id → {file_path → {functions, imports, calls}}


def get_chunks(user_id: str) -> list:
    if user_id not in _chunk_stores:
        _chunk_stores[user_id] = []
    return _chunk_stores[user_id]


def get_graph(user_id: str) -> dict:
    if user_id not in _graphs:
        _graphs[user_id] = {}
    return _graphs[user_id]


def clear_user_repo(user_id: str, repo_id: str) -> None:
    """Remove only the chunks/graph entries for a specific repo (not all user data)."""
    if user_id in _chunk_stores:
        _chunk_stores[user_id] = [
            c for c in _chunk_stores[user_id]
            if c.get("metadata", {}).get("repo_id") != repo_id
        ]
    if user_id in _graphs:
        _graphs[user_id] = {
            fp: data for fp, data in _graphs[user_id].items()
            if not fp.startswith(f"repo:{repo_id}:")
        }


def set_graph(user_id: str, graph_data: dict) -> None:
    _graphs[user_id] = graph_data
