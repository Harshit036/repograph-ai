"""Graph retrieval helpers — used by the RAG pipeline and tool services.

get_active_graph()         → simplified dict for LLM prompts (arch/onboarding)
get_graph_neighbors()      → multi-hop file import context for RAG citations
get_graph_neighbors_for_repo() → same but avoids a redundant DB lookup when
                                  repo_id is already known in the caller
"""
import logging
from app.core.user_context import get_user_id

logger = logging.getLogger(__name__)


def _get_latest_repo(user_id: str) -> dict | None:
    """Return the most recently ingested repo row for a user, or None."""
    try:
        from app.db.migrations import get_user_repos
        from app.core.config import get_settings
        repos = get_user_repos(get_settings().database_url, user_id)
        return repos[0] if repos else None
    except Exception as e:
        logger.warning("_get_latest_repo error: %s", e)
        return None


def get_active_repo_id(user_id: str) -> str | None:
    repo = _get_latest_repo(user_id)
    return repo["repo_id"] if repo else None


def get_active_graph(user_id: str, limit: int = 20) -> dict:
    """Graph dict for LLM prompts.  Falls back to JSONB for pre-Neo4j repos."""
    try:
        from app.db.neo4j import get_graph_for_summary
        repo = _get_latest_repo(user_id)
        if repo:
            g = get_graph_for_summary(user_id, repo["repo_id"], limit=limit)
            if g:
                return g
    except Exception as e:
        logger.warning("get_active_graph Neo4j error: %s", e)

    # Fallback: JSONB persisted in Postgres (repos ingested before Neo4j)
    try:
        from app.db.migrations import load_graph_for_user
        return load_graph_for_user(user_id)
    except Exception:
        return {}


def get_graph_neighbors(file_path: str) -> list[str]:
    """2-hop import neighbors for a file.  Used inline in the RAG pipeline."""
    user_id = get_user_id()
    repo_id = get_active_repo_id(user_id)
    if not repo_id:
        return []
    return get_graph_neighbors_for_repo(file_path, user_id, repo_id)


def get_graph_neighbors_for_repo(file_path: str, user_id: str, repo_id: str) -> list[str]:
    """Efficient variant when user_id/repo_id are already known by the caller."""
    try:
        from app.db.neo4j import get_file_neighbors
        return get_file_neighbors(user_id, repo_id, file_path, hops=2)
    except Exception as e:
        logger.warning("get_graph_neighbors error: %s", e)
        return []
