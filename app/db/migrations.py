"""Run idempotent DB migrations at startup.

Repositories and chat history are no longer persisted — the active repo lives in
memory (`app.storage.user_stores`) and conversations are session-only. Only the
`users` table and the pgvector embedding index remain.
"""

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
