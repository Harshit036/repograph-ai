from __future__ import annotations

from langchain_core.embeddings import Embeddings
from langchain_postgres import PGVector

from app.core.config import get_settings

COLLECTION_NAME = "repository_chunks"

# Lazy globals — created once on first use
_vectorstore: PGVector | None = None


class _RepoEmbeddings(Embeddings):
    """Thin LangChain Embeddings wrapper so PGVector can re-embed on search."""

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
    """Create pgvector tables and reload chunk_store + repository_graph from DB."""
    try:
        vs = _get_vectorstore()
        vs.create_vector_extension()
        vs.create_tables_if_not_exists()
        vs.create_collection()
        print("Vector DB initialised (PostgreSQL + pgvector)")
        _reload_memory_stores()
    except Exception as e:
        print(f"Vector DB init failed (PostgreSQL unavailable?): {e}")


def _reload_memory_stores() -> None:
    """Populate in-memory chunk_store and repository_graph from stored embeddings."""
    try:
        import psycopg2
        from app.core.config import get_settings
        from app.storage.chunk_store import chunk_store
        from app.storage.repository_graph import repository_graph

        settings = get_settings()
        # Parse connection URL to psycopg2 kwargs
        url = settings.database_url.replace("postgresql+psycopg2://", "")
        user_pass, rest = url.split("@")
        user, password = user_pass.split(":")
        host_port, dbname = rest.split("/")
        host, port = (host_port.split(":") + ["5432"])[:2]

        conn = psycopg2.connect(host=host, port=int(port), dbname=dbname,
                                user=user, password=password)
        cur = conn.cursor()
        cur.execute("""
            SELECT e.document, e.cmetadata
            FROM langchain_pg_embedding e
            JOIN langchain_pg_collection c ON e.collection_id = c.uuid
            WHERE c.name = %s
        """, (COLLECTION_NAME,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        chunk_store.clear()
        seen_files: dict = {}
        for doc, meta in rows:
            chunk_store.append({"content": doc, "metadata": meta})
            fp = meta.get("file_path", "")
            if fp and fp not in seen_files:
                seen_files[fp] = {"functions": [], "imports": [], "calls": []}

        if seen_files and not repository_graph:
            repository_graph.update(seen_files)

        print(f"Reloaded {len(chunk_store)} chunks and {len(seen_files)} files from DB")
    except Exception as e:
        print(f"Memory reload skipped: {e}")


def store_chunk(chunk_id: str, embedding: list, content: str, metadata: dict) -> None:
    """Store a single chunk with its pre-computed embedding."""
    try:
        _get_vectorstore().add_embeddings(
            texts=[content],
            embeddings=[embedding],
            metadatas=[metadata],
            ids=[chunk_id],
        )
    except Exception as e:
        print(f"Vector store failed (PostgreSQL unavailable?): {e}")


def search_similar_chunks(query_embedding: list, top_k: int = 5) -> dict:
    """Search by vector. Returns ChromaDB-compatible shape for backward compat."""
    _empty = {"documents": [[]], "metadatas": [[]]}
    try:
        results = _get_vectorstore().similarity_search_by_vector(
            embedding=query_embedding, k=top_k
        )
        docs = [doc.page_content for doc in results]
        metas = [doc.metadata for doc in results]
        return {"documents": [docs], "metadatas": [metas]}
    except Exception as e:
        print(f"Vector search failed (PostgreSQL unavailable?): {e}")
        return _empty
