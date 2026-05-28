"""Shared fixtures for all tests. Mocks are applied at module level so
sentence-transformers and torch never download models during CI."""
import sys
import types
from unittest.mock import MagicMock, patch
import pytest


# ── Patch heavy models before any service is imported ─────────────────────────

def _make_fake_embedding_module():
    mod = types.ModuleType("app.services.embedding_service")
    mod.embedding_model = MagicMock()
    mod.embedding_model.encode.return_value = [0.1] * 384
    mod.generate_embedding = lambda text: [0.1] * 384
    return mod


def _make_fake_reranking_module():
    mod = types.ModuleType("app.services.reranking_service")
    cross_encoder = MagicMock()
    cross_encoder.predict.return_value = [0.9, 0.5, 0.3]
    mod.cross_encoder = cross_encoder
    from app.services.reranking_service import semantic_deduplicate, mmr
    mod.semantic_deduplicate = semantic_deduplicate
    mod.mmr = mmr

    def neural_rerank(query, pairs, top_k=5):
        scores = cross_encoder.predict([(query, doc) for doc, _ in pairs])
        scored = sorted(zip(scores, pairs), key=lambda x: x[0], reverse=True)
        return [pair for _, pair in scored[:top_k]]

    mod.neural_rerank = neural_rerank
    return mod


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_embedding():
    with patch("app.services.embedding_service.generate_embedding", return_value=[0.1] * 384):
        yield


@pytest.fixture
def mock_llm():
    with patch("app.services.llm_service.ollama") as mock:
        mock.chat.return_value = {"message": {"content": "mocked LLM response"}}
        yield mock


@pytest.fixture
def mock_cross_encoder():
    with patch("app.services.reranking_service.cross_encoder") as mock:
        mock.predict.return_value = [0.9, 0.5, 0.3, 0.2, 0.1]
        yield mock


@pytest.fixture
def mock_vector_db():
    """Patch search_similar_chunks at the location hybrid_retrieval_service imports it from."""
    sample_docs = ["def generate_embedding(text): ...", "class RAGService: ..."]
    sample_metas = [
        {"file_name": "embedding_service.py", "file_path": "/repo/embedding_service.py"},
        {"file_name": "rag_service.py", "file_path": "/repo/rag_service.py"},
    ]
    return_value = {"documents": [sample_docs], "metadatas": [sample_metas]}
    with patch("app.services.hybrid_retrieval_service.search_similar_chunks", return_value=return_value), \
         patch("app.services.vector_db_service.search_similar_chunks", return_value=return_value):
        yield


@pytest.fixture
def sample_chunk_store(monkeypatch):
    """Populate the in-memory chunk_store at the location hybrid_retrieval_service uses."""
    data = [
        {"content": "def generate_embedding(text): return model.encode(text)", "metadata": {"file_name": "embedding_service.py"}},
        {"content": "class RAGService: def query(self): pass", "metadata": {"file_name": "rag_service.py"}},
        {"content": "def bm25_search(query, top_k): return results", "metadata": {"file_name": "hybrid_retrieval_service.py"}},
    ]
    monkeypatch.setattr("app.services.hybrid_retrieval_service.chunk_store", data)
    return data
