import pytest
from app.services.hybrid_retrieval_service import bm25_search, reciprocal_rank_fusion


class TestBM25:
    def test_returns_at_most_top_k(self, sample_chunk_store):
        results = bm25_search("embedding pipeline", top_k=2)
        assert len(results) <= 2

    def test_relevant_doc_ranked_higher(self, sample_chunk_store):
        results = bm25_search("generate_embedding", top_k=3)
        assert len(results) > 0
        # The embedding doc should be first or second
        contents = [r["content"] for r in results]
        assert any("generate_embedding" in c for c in contents)

    def test_empty_store_returns_empty(self, monkeypatch):
        import app.storage.chunk_store as cs
        monkeypatch.setattr(cs, "chunk_store", [])
        results = bm25_search("anything", top_k=5)
        assert results == []


class TestRRF:
    def test_doc_in_both_lists_scores_higher(self):
        ranking1 = ["doc_a", "doc_b", "doc_c"]
        ranking2 = ["doc_c", "doc_a", "doc_d"]
        scores = reciprocal_rank_fusion([ranking1, ranking2])
        # doc_a appears in both → should score higher than doc_d (only in ranking2)
        assert scores["doc_a"] > scores["doc_d"]

    def test_top_ranked_in_both_wins(self):
        ranking1 = ["winner", "loser"]
        ranking2 = ["winner", "other"]
        scores = reciprocal_rank_fusion([ranking1, ranking2])
        assert scores["winner"] == max(scores.values())

    def test_empty_rankings_returns_empty(self):
        scores = reciprocal_rank_fusion([[], []])
        assert scores == {}

    def test_k_parameter_shifts_scores(self):
        ranking = ["doc_a"]
        scores_k60 = reciprocal_rank_fusion([ranking], k=60)
        scores_k1 = reciprocal_rank_fusion([ranking], k=1)
        # Smaller k → higher score (less penalty on position)
        assert scores_k1["doc_a"] > scores_k60["doc_a"]
