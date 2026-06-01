"""Per-user scoped in-memory stores.

Only chunks (needed for BM25) are kept in memory.
Graph data now lives entirely in Neo4j — no in-memory graph cache.
Chunks are lazy-loaded from pgvector on first access so queries work after
a container restart without requiring re-ingestion.
"""

_chunk_stores: dict[str, list] = {}  # user_id → [{"content": ..., "metadata": ...}]
_chunks_loaded: set[str] = set()     # user_ids whose chunks have been loaded from DB


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


def set_chunks(user_id: str, chunks: list) -> None:
    _chunk_stores[user_id] = chunks
    _chunks_loaded.add(user_id)


def clear_user_repo(user_id: str, repo_id: str) -> None:
    """Remove chunks for the given repo and clear the Neo4j graph for it."""
    if user_id in _chunk_stores:
        _chunk_stores[user_id] = [
            c for c in _chunk_stores[user_id]
            if c.get("metadata", {}).get("repo_id") != repo_id
        ]
    _chunks_loaded.discard(user_id)

    # Clear graph from Neo4j
    try:
        from app.db.neo4j import clear_repo_graph
        clear_repo_graph(user_id, repo_id)
    except Exception as e:
        print(f"Neo4j clear_repo_graph error: {e}")
