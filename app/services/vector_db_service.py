from __future__ import annotations

from langchain_core.embeddings import Embeddings
from langchain_postgres import PGVector

from app.core.config import get_settings

COLLECTION_NAME = "repository_chunks"

_vectorstore: PGVector | None = None


class _RepoEmbeddings(Embeddings):
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        from app.services.embedding_service import generate_embedding
        return [generate_embedding(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        from app.services.embedding_service import generate_embedding
        return generate_embedding(text)


def _get_vectorstore() -> PGVector:
    global _vectorstore
    if _vectorstore is None:
        settings = get_settings()
        _vectorstore = PGVector(
            embeddings=_RepoEmbeddings(),
            collection_name=COLLECTION_NAME,
            connection=settings.database_url,
            embedding_length=settings.embedding_dim,
            use_jsonb=True,
        )
    return _vectorstore


def init_db() -> None:
    try:
        vs = _get_vectorstore()
        vs.create_vector_extension()
        vs.create_tables_if_not_exists()
        vs.create_collection()
        print("Vector DB initialised (PostgreSQL + pgvector)")
    except Exception as e:
        print(f"Vector DB init failed (PostgreSQL unavailable?): {e}")


def store_chunk(chunk_id: str, embedding: list, content: str, metadata: dict) -> None:
    try:
        _get_vectorstore().add_embeddings(
            texts=[content],
            embeddings=[embedding],
            metadatas=[metadata],
            ids=[chunk_id],
        )
    except Exception as e:
        print(f"Vector store failed: {e}")


def load_chunks_for_user(user_id: str) -> list[dict]:
    """Fetch all stored chunks for a user from pgvector (used to rebuild BM25 store)."""
    try:
        import psycopg2
        from app.core.config import get_settings
        settings = get_settings()
        url = settings.database_url.replace("postgresql+psycopg2://", "")
        user_pass, rest = url.split("@")
        user, password = user_pass.split(":")
        host_port, dbname = rest.split("/")
        host, port = (host_port.split(":") + ["5432"])[:2]
        conn = psycopg2.connect(host=host, port=int(port), dbname=dbname, user=user, password=password)
        cur = conn.cursor()
        cur.execute(
            "SELECT document, cmetadata FROM langchain_pg_embedding WHERE cmetadata->>'user_id' = %s",
            (user_id,)
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [{"content": r[0], "metadata": r[1]} for r in rows]
    except Exception as e:
        print(f"load_chunks_for_user error: {e}")
        return []


def search_similar_chunks(query_embedding: list, user_id: str, top_k: int = 5,
                          repo_ids: list[str] | None = None) -> dict:
    """Search by vector, scoped to the given user (and optionally specific repos)."""
    _empty = {"documents": [[]], "metadatas": [[]]}
    try:
        if repo_ids:
            # LangChain PGVector supports $in operator for JSONB metadata
            search_filter = {"user_id": user_id, "repo_id": {"$in": repo_ids}}
        else:
            search_filter = {"user_id": user_id}
        results = _get_vectorstore().similarity_search_by_vector(
            embedding=query_embedding,
            k=top_k,
            filter=search_filter,
        )
        docs = [doc.page_content for doc in results]
        metas = [doc.metadata for doc in results]
        return {"documents": [docs], "metadatas": [metas]}
    except Exception as e:
        print(f"Vector search failed: {e}")
        return _empty
