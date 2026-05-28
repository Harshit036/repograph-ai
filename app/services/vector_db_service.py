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
    """Create pgvector extension and LangChain tables. Called on app startup."""
    try:
        vs = _get_vectorstore()
        vs.create_vector_extension()
        vs.create_tables_if_not_exists()
        vs.create_collection()
        print("Vector DB initialised (PostgreSQL + pgvector)")
    except Exception as e:
        print(f"Vector DB init failed (PostgreSQL unavailable?): {e}")


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
