import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    with patch("app.services.vector_db_service.init_db"):
        from app.main import app
        return TestClient(app, raise_server_exceptions=False)


class TestAuthMiddleware:
    def test_health_no_key_required(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_no_key_returns_401(self, client):
        response = client.post("/rag-query", json={"query": "test"})
        assert response.status_code == 401

    def test_wrong_key_returns_401(self, client):
        response = client.post(
            "/rag-query",
            json={"query": "test"},
            headers={"X-API-Key": "wrong-key"},
        )
        assert response.status_code == 401

    def test_correct_key_passes_middleware(self, client):
        # Patch everything downstream so auth is the only thing being tested
        with patch("app.core.config.get_settings") as mock_settings, \
             patch("app.services.hybrid_retrieval_service.search_similar_chunks",
                   return_value={"documents": [[]], "metadatas": [[]]}), \
             patch("app.services.hybrid_retrieval_service.chunk_store", []), \
             patch("app.services.llm_service.ollama") as mock_ollama, \
             patch("app.services.embedding_service.generate_embedding", return_value=[0.1]*384), \
             patch("app.services.rag_service.get_graph_neighbors", return_value=[]):
            mock_settings.return_value.api_key = "test-key"
            mock_ollama.chat.return_value = {"message": {"content": "test"}}
            response = client.post(
                "/rag-query",
                json={"query": "test"},
                headers={"X-API-Key": "test-key"},
            )
        # May fail for other reasons (DB not available) but must not be 401
        assert response.status_code != 401

    def test_docs_no_key_required(self, client):
        response = client.get("/docs")
        assert response.status_code == 200

    def test_openapi_no_key_required(self, client):
        response = client.get("/openapi.json")
        assert response.status_code == 200
