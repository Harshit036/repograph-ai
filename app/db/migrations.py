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
        # Add repo_summary column if table already existed without it
        cur.execute("""
            ALTER TABLE user_repos ADD COLUMN IF NOT EXISTS repo_summary TEXT
        """)

        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_embedding_user_repo
            ON langchain_pg_embedding
            ((cmetadata->>'user_id'), (cmetadata->>'repo_id'))
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
