"""Per-user scoped in-memory stores.

Chunks (needed for BM25) and the active repo record are kept in memory.
Graph data lives entirely in Neo4j — no in-memory graph cache.
Chunks are lazy-loaded from pgvector on first access so queries work after
a container restart without requiring re-ingestion.

The active-repo registry replaces the old `user_repos` table: repositories are
no longer persisted. Only the single currently-ingested repo is tracked, and it
is reconstructed from pgvector chunk metadata after a restart.
"""

_chunk_stores: dict[str, list] = {}  # user_id → [{"content": ..., "metadata": ...}]
_chunks_loaded: set[str] = set()     # user_ids whose chunks have been loaded from DB
_active_repos: dict[str, dict] = {}  # user_id → active repo record


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


# ── Active repo registry ─────────────────────────────────────────────────────

def set_active_repo(user_id: str, record: dict) -> None:
    """Record the currently-ingested repo. Replaces any previous active repo."""
    _active_repos[user_id] = record


def update_active_repo_summary(user_id: str, repo_id: str, summary: str) -> None:
    """Attach the LLM-generated summary to the active repo (background thread)."""
    rec = _active_repos.get(user_id)
    if rec and rec.get("repo_id") == repo_id:
        rec["summary"] = summary


def get_active_repo(user_id: str) -> dict | None:
    """Return the active repo record, reconstructing it from pgvector metadata
    after a restart if the in-memory record was lost."""
    rec = _active_repos.get(user_id)
    if rec:
        return rec

    # Fallback: rebuild a minimal record from chunk metadata (survives restarts).
    chunks = get_chunks(user_id)
    if chunks:
        meta = chunks[0].get("metadata", {}) or {}
        repo_id = meta.get("repo_id")
        if repo_id:
            rec = {
                "repo_id": repo_id,
                "repo_url": meta.get("repo_url", ""),
                "commit_sha": meta.get("commit_sha", ""),
                "file_count": 0,
                "chunk_count": len(chunks),
                "readme": "",
                "summary": "",
            }
            _active_repos[user_id] = rec
            return rec
    return None


def clear_user_repo(user_id: str, repo_id: str) -> None:
    """Remove chunks for the given repo and clear the Neo4j graph for it."""
    if user_id in _chunk_stores:
        _chunk_stores[user_id] = [
            c for c in _chunk_stores[user_id]
            if c.get("metadata", {}).get("repo_id") != repo_id
        ]
    _chunks_loaded.discard(user_id)

    if _active_repos.get(user_id, {}).get("repo_id") == repo_id:
        _active_repos.pop(user_id, None)

    # Clear graph from Neo4j
    try:
        from app.db.neo4j import clear_repo_graph
        clear_repo_graph(user_id, repo_id)
    except Exception as e:
        print(f"Neo4j clear_repo_graph error: {e}")
