"""Run idempotent DB migrations at startup."""

import psycopg2


def _get_conn(database_url: str):
    url = database_url.replace("postgresql+psycopg2://", "")
    user_pass, rest = url.split("@")
    user, password = user_pass.split(":")
    host_port, dbname = rest.split("/")
    host, port = (host_port.split(":") + ["5432"])[:2]
    return psycopg2.connect(host=host, port=int(port), dbname=dbname,
                            user=user, password=password)


def run_migrations(database_url: str) -> None:
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          TEXT PRIMARY KEY,
                github_login TEXT,
                avatar_url  TEXT,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_repos (
                id           SERIAL PRIMARY KEY,
                user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                repo_url     TEXT NOT NULL,
                repo_id      TEXT NOT NULL,
                commit_sha   TEXT,
                file_count   INT  DEFAULT 0,
                chunk_count  INT  DEFAULT 0,
                repo_summary TEXT,
                ingested_at  TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, repo_id)
            )
        """)
        # Add columns if table already existed without them
        cur.execute("ALTER TABLE user_repos ADD COLUMN IF NOT EXISTS repo_summary TEXT")
        cur.execute("ALTER TABLE user_repos ADD COLUMN IF NOT EXISTS graph_data  JSONB")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS repo_files (
                user_id   TEXT NOT NULL,
                repo_id   TEXT NOT NULL,
                file_path TEXT NOT NULL,
                content   TEXT NOT NULL,
                language  TEXT NOT NULL DEFAULT 'text',
                PRIMARY KEY (user_id, repo_id, file_path)
            )
        """)

        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_repo_files_user_repo
            ON repo_files (user_id, repo_id)
        """)

        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_embedding_user_repo
            ON langchain_pg_embedding
            ((cmetadata->>'user_id'), (cmetadata->>'repo_id'))
        """)

        # ── Chat history ───────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id    TEXT NOT NULL,
                title      TEXT,
                repo_ids   JSONB NOT NULL DEFAULT '[]',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
            ON chat_sessions (user_id, updated_at DESC)
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role       TEXT NOT NULL,
                content    TEXT NOT NULL,
                citations  JSONB,
                actions    JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session
            ON chat_messages (session_id, created_at ASC)
        """)

        conn.commit()
        cur.close()
        conn.close()
        print("DB migrations applied")
    except Exception as e:
        print(f"Migration warning (table may already exist): {e}")


def upsert_user(database_url: str, user_id: str, github_login: str, avatar_url: str) -> None:
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO users (id, github_login, avatar_url)
            VALUES (%s, %s, %s)
            ON CONFLICT (id) DO UPDATE
              SET github_login = EXCLUDED.github_login,
                  avatar_url   = EXCLUDED.avatar_url
        """, (user_id, github_login, avatar_url))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"upsert_user error: {e}")


def get_user_repos(database_url: str, user_id: str) -> list[dict]:
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute("""
            SELECT repo_url, repo_id, commit_sha, file_count, chunk_count, ingested_at
            FROM user_repos
            WHERE user_id = %s
            ORDER BY ingested_at DESC
        """, (user_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [
            {
                "repo_url": r[0], "repo_id": r[1], "commit_sha": r[2],
                "file_count": r[3], "chunk_count": r[4],
                "ingested_at": r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ]
    except Exception as e:
        print(f"get_user_repos error: {e}")
        return []


def get_repo_entry(database_url: str, user_id: str, repo_id: str) -> dict | None:
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute("""
            SELECT repo_url, commit_sha, file_count, chunk_count
            FROM user_repos WHERE user_id = %s AND repo_id = %s
        """, (user_id, repo_id))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return {"repo_url": row[0], "commit_sha": row[1],
                    "file_count": row[2], "chunk_count": row[3]}
        return None
    except Exception as e:
        print(f"get_repo_entry error: {e}")
        return None


def upsert_repo_entry(database_url: str, user_id: str, repo_url: str, repo_id: str,
                      commit_sha: str, file_count: int, chunk_count: int,
                      repo_summary: str = "") -> None:
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO user_repos (user_id, repo_url, repo_id, commit_sha, file_count, chunk_count, repo_summary)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, repo_id) DO UPDATE
              SET commit_sha   = EXCLUDED.commit_sha,
                  file_count   = EXCLUDED.file_count,
                  chunk_count  = EXCLUDED.chunk_count,
                  repo_summary = EXCLUDED.repo_summary,
                  ingested_at  = NOW()
        """, (user_id, repo_url, repo_id, commit_sha, file_count, chunk_count, repo_summary))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"upsert_repo_entry error: {e}")


def save_graph_for_user(database_url: str, user_id: str, graph_data: dict) -> None:
    """Merge and persist the in-memory graph into each user_repos row for this user."""
    import json
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute(
            "UPDATE user_repos SET graph_data = %s WHERE user_id = %s",
            (json.dumps(graph_data), user_id)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"save_graph_for_user error: {e}")


def load_graph_for_user(user_id: str) -> dict:
    """Load the most recent persisted graph for a user."""
    import json
    try:
        from app.core.config import get_settings
        database_url = get_settings().database_url
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute(
            "SELECT graph_data FROM user_repos WHERE user_id = %s AND graph_data IS NOT NULL ORDER BY ingested_at DESC LIMIT 1",
            (user_id,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row and row[0]:
            return row[0] if isinstance(row[0], dict) else json.loads(row[0])
        return {}
    except Exception as e:
        print(f"load_graph_for_user error: {e}")
        return {}


def bulk_insert_repo_files(database_url: str, user_id: str, repo_id: str,
                           files: list[dict]) -> None:
    """Persist full file contents for the Code Explorer. files = [{file_path, content, language}]"""
    if not files:
        return
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute("DELETE FROM repo_files WHERE user_id = %s AND repo_id = %s", (user_id, repo_id))
        cur.executemany(
            "INSERT INTO repo_files (user_id, repo_id, file_path, content, language) VALUES (%s, %s, %s, %s, %s)",
            [(user_id, repo_id, f["file_path"], f["content"], f["language"]) for f in files],
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"bulk_insert_repo_files error: {e}")


def get_repo_file_tree(database_url: str, user_id: str, repo_id: str) -> list[dict]:
    """Return [{file_path, language, size}] for the file tree panel."""
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute(
            "SELECT file_path, language, length(content) FROM repo_files WHERE user_id = %s AND repo_id = %s ORDER BY file_path",
            (user_id, repo_id),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [{"file_path": r[0], "language": r[1], "size": r[2]} for r in rows]
    except Exception as e:
        print(f"get_repo_file_tree error: {e}")
        return []


def get_repo_file_content(database_url: str, user_id: str, repo_id: str,
                           file_path: str) -> dict | None:
    """Return {content, language} for a single file."""
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute(
            "SELECT content, language FROM repo_files WHERE user_id = %s AND repo_id = %s AND file_path = %s",
            (user_id, repo_id, file_path),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        return {"content": row[0], "language": row[1]} if row else None
    except Exception as e:
        print(f"get_repo_file_content error: {e}")
        return None


def get_repo_file_count(database_url: str, user_id: str, repo_id: str) -> int:
    """Return number of files stored for this repo (0 means Code Explorer needs re-ingest)."""
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM repo_files WHERE user_id = %s AND repo_id = %s",
            (user_id, repo_id),
        )
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return count
    except Exception as e:
        print(f"get_repo_file_count error: {e}")
        return 0


# ── Chat sessions ──────────────────────────────────────────────────────────────

def get_chat_sessions(database_url: str, user_id: str) -> list[dict]:
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute(
            "SELECT id, title, repo_ids, created_at, updated_at FROM chat_sessions WHERE user_id = %s ORDER BY updated_at DESC LIMIT 100",
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [
            {"id": r[0], "title": r[1] or "Untitled chat", "repo_ids": r[2] or [],
             "created_at": r[3].isoformat() if r[3] else None,
             "updated_at": r[4].isoformat() if r[4] else None}
            for r in rows
        ]
    except Exception as e:
        print(f"get_chat_sessions error: {e}")
        return []


def create_chat_session(database_url: str, user_id: str, title: str = "", repo_ids: list = None) -> dict:
    import json
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO chat_sessions (user_id, title, repo_ids) VALUES (%s, %s, %s) RETURNING id, title, repo_ids, created_at, updated_at",
            (user_id, title or "New chat", json.dumps(repo_ids or [])),
        )
        r = cur.fetchone()
        conn.commit(); cur.close(); conn.close()
        return {"id": r[0], "title": r[1], "repo_ids": r[2] or [],
                "created_at": r[3].isoformat() if r[3] else None,
                "updated_at": r[4].isoformat() if r[4] else None}
    except Exception as e:
        print(f"create_chat_session error: {e}")
        return {}


def update_session_title(database_url: str, session_id: str, user_id: str, title: str) -> bool:
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute(
            "UPDATE chat_sessions SET title = %s, updated_at = NOW() WHERE id = %s AND user_id = %s",
            (title, session_id, user_id),
        )
        conn.commit(); cur.close(); conn.close()
        return True
    except Exception as e:
        print(f"update_session_title error: {e}")
        return False


def delete_chat_session(database_url: str, session_id: str, user_id: str) -> bool:
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute("DELETE FROM chat_sessions WHERE id = %s AND user_id = %s", (session_id, user_id))
        conn.commit(); cur.close(); conn.close()
        return True
    except Exception as e:
        print(f"delete_chat_session error: {e}")
        return False


def get_session_messages(database_url: str, session_id: str, user_id: str) -> list[dict]:
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        # Verify session belongs to user
        cur.execute("SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s", (session_id, user_id))
        if not cur.fetchone():
            cur.close(); conn.close()
            return []
        cur.execute(
            "SELECT id, role, content, citations, actions, created_at FROM chat_messages WHERE session_id = %s ORDER BY created_at ASC",
            (session_id,),
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [
            {"id": r[0], "role": r[1], "content": r[2],
             "citations": r[3], "actions": r[4],
             "created_at": r[5].isoformat() if r[5] else None}
            for r in rows
        ]
    except Exception as e:
        print(f"get_session_messages error: {e}")
        return []


def save_session_message(database_url: str, session_id: str, role: str, content: str,
                          citations=None, actions=None) -> dict:
    import json
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO chat_messages (session_id, role, content, citations, actions) VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at",
            (session_id, role, content,
             json.dumps(citations) if citations else None,
             json.dumps(actions) if actions else None),
        )
        r = cur.fetchone()
        # Bump session updated_at
        cur.execute("UPDATE chat_sessions SET updated_at = NOW() WHERE id = %s", (session_id,))
        conn.commit(); cur.close(); conn.close()
        return {"id": r[0], "role": role, "content": content,
                "citations": citations, "actions": actions,
                "created_at": r[1].isoformat() if r[1] else None}
    except Exception as e:
        print(f"save_session_message error: {e}")
        return {}


def delete_repo_embeddings(database_url: str, user_id: str, repo_id: str) -> None:
    """Delete all stored embeddings for a user+repo before re-ingestion."""
    try:
        conn = _get_conn(database_url)
        cur = conn.cursor()
        cur.execute("""
            DELETE FROM langchain_pg_embedding
            WHERE cmetadata->>'user_id' = %s
              AND cmetadata->>'repo_id' = %s
        """, (user_id, repo_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"delete_repo_embeddings error: {e}")
