"""Graph retrieval helpers — used by the RAG pipeline and tool services.

get_active_graph()         → simplified dict for LLM prompts (arch/onboarding)
get_graph_neighbors()      → multi-hop file import context for RAG citations
get_graph_neighbors_for_repo() → same but avoids a redundant DB lookup when
                                  repo_id is already known in the caller
"""
import logging
import re
from app.core.user_context import get_user_id

logger = logging.getLogger(__name__)


def _to_relative_path(path: str) -> str:
    """Strip the temp clone prefix to get a repo-relative file path.

    Repos are cloned via tempfile.mkdtemp(prefix="repograph_") so paths look like:
      /tmp/repograph_abc123/app/main.py  →  app/main.py
    Legacy paths (if any) may have an extra /repositories/<name>/ segment:
      /tmp/repograph_abc123/repositories/<repo>/app/main.py  →  app/main.py
    """
    if not path or path in ("unknown", "external"):
        return path
    # Legacy: explicit /repositories/<repo-name>/ segment
    m = re.search(r'/repositories/[^/]+/(.+)', path)
    if m:
        return m.group(1)
    # Current: /tmp/repograph_<hash>/<direct-content>
    m = re.search(r'/tmp/repograph_[^/]+/(.+)', path)
    if m:
        return m.group(1)
    # Generic tmpdir fallback (e.g. /private/tmp on macOS, or custom TMPDIR)
    m = re.search(r'/tmp[^/]*/repograph_[^/]+/(.+)', path)
    if m:
        return m.group(1)
    return path


def _get_latest_repo(user_id: str) -> dict | None:
    """Return the active (currently-ingested) repo record for a user, or None.

    Repos are no longer persisted — this reads the in-memory registry, which
    reconstructs itself from pgvector chunk metadata after a restart.
    """
    try:
        from app.storage.user_stores import get_active_repo
        return get_active_repo(user_id)
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
