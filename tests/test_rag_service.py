import pytest
from unittest.mock import patch


class TestGenerateRagResponse:
    def test_returns_response_and_citations(self, mock_llm, mock_vector_db, mock_embedding):
        with patch("app.services.rag_service.get_graph_neighbors", return_value=[]):
            from app.services.rag_service import generate_rag_response
            result = generate_rag_response("how does chunking work")
        assert "response" in result
        assert "citations" in result

    def test_response_is_string(self, mock_llm, mock_vector_db, mock_embedding):
        with patch("app.services.rag_service.get_graph_neighbors", return_value=[]):
            from app.services.rag_service import generate_rag_response
            result = generate_rag_response("explain the graph service")
        assert isinstance(result["response"], str)
        assert len(result["response"]) > 0

    def test_citations_reference_files(self, mock_llm, mock_vector_db, mock_embedding):
        with patch("app.services.rag_service.get_graph_neighbors", return_value=[]):
            from app.services.rag_service import generate_rag_response
            result = generate_rag_response("what is the embedding pipeline")
        assert len(result["citations"]) > 0
        for c in result["citations"]:
            assert "source_id" in c
            assert "file" in c
            assert "preview" in c

    def test_citation_preview_is_truncated(self, mock_llm, mock_vector_db, mock_embedding):
        with patch("app.services.rag_service.get_graph_neighbors", return_value=[]):
            from app.services.rag_service import generate_rag_response
            result = generate_rag_response("test query")
        for c in result["citations"]:
            assert len(c["preview"]) <= 200
