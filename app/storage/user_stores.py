"""Per-user scoped in-memory stores.

Chunks are lazy-loaded from pgvector on first access so queries work after
a container restart without requiring re-ingestion.
Graph data is persisted to DB and lazy-loaded similarly.
"""

_chunk_stores: dict[str, list] = {}   # user_id → [{"content": ..., "metadata": ...}]
_graphs: dict[str, dict] = {}          # user_id → {file_path → {functions, imports, calls}}
_chunks_loaded: set[str] = set()       # user_ids whose chunks have been loaded from DB
_graphs_loaded: set[str] = set()       # user_ids whose graphs have been loaded from DB


def get_chunks(user_id: str) -> list:
    if user_id not in _chunks_loaded:
        _chunks_loaded.add(user_id)
        if not _chunk_stores.get(user_id):
            try:
                from app.services.vector_db_service import load_chunks_for_user
                loaded = load_chunks_for_user(user_id)
                if loaded:
                    _chunk_stores[user_id] = loaded
                    print(f"Lazy-loaded {len(loaded)} chunks for user {user_id}")
            except Exception as e:
                print(f"Chunk lazy-load error: {e}")
    return _chunk_stores.get(user_id, [])


def get_graph(user_id: str) -> dict:
    if user_id not in _graphs_loaded:
        _graphs_loaded.add(user_id)
        if not _graphs.get(user_id):
            try:
                from app.db.migrations import load_graph_for_user
                loaded = load_graph_for_user(user_id)
                if loaded:
                    _graphs[user_id] = loaded
                    print(f"Lazy-loaded graph for user {user_id} ({len(loaded)} files)")
            except Exception as e:
                print(f"Graph lazy-load error: {e}")
    return _graphs.get(user_id, {})


def set_graph(user_id: str, graph_data: dict) -> None:
    _graphs[user_id] = graph_data
    _graphs_loaded.add(user_id)


def clear_user_repo(user_id: str, repo_id: str) -> None:
    """Remove only the chunks/graph entries for a specific repo."""
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
    # Force reload on next access so fresh data is used
    _chunks_loaded.discard(user_id)
    _graphs_loaded.discard(user_id)
