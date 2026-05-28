import pytest


class TestNeuralRerank:
    def test_reranks_by_score(self, mock_cross_encoder):
        from app.services.reranking_service import neural_rerank
        pairs = [
            ("unrelated content about cats", {}),
            ("embedding pipeline code", {}),
            ("generate_embedding function", {}),
        ]
        # mock_cross_encoder.predict returns [0.9, 0.5, 0.3, 0.2, 0.1]
        result = neural_rerank("embedding pipeline", pairs, top_k=2)
        assert len(result) == 2

    def test_empty_pairs_returns_empty(self, mock_cross_encoder):
        from app.services.reranking_service import neural_rerank
        assert neural_rerank("query", [], top_k=5) == []

    def test_top_k_limits_results(self, mock_cross_encoder):
        from app.services.reranking_service import neural_rerank
        pairs = [("doc", {}) for _ in range(5)]
        result = neural_rerank("query", pairs, top_k=3)
        assert len(result) <= 3


class TestSemanticDeduplicate:
    def test_identical_docs_deduplicated(self, mock_embedding):
        from app.services.reranking_service import semantic_deduplicate
        pairs = [("same content", {})] * 5
        result = semantic_deduplicate(pairs, threshold=0.90)
        # All have identical embeddings → cosine similarity = 1.0 > threshold → only 1 kept
        assert len(result) == 1

    def test_single_pair_returned_unchanged(self, mock_embedding):
        from app.services.reranking_service import semantic_deduplicate
        pairs = [("only doc", {})]
        assert semantic_deduplicate(pairs) == pairs


class TestMMR:
    def test_returns_at_most_top_k(self, mock_embedding):
        from app.services.reranking_service import mmr
        pairs = [("doc " + str(i), {}) for i in range(10)]
        result = mmr("query", pairs, top_k=4)
        assert len(result) <= 4

    def test_fewer_pairs_than_top_k_returned_as_is(self, mock_embedding):
        from app.services.reranking_service import mmr
        pairs = [("doc", {})] * 3
        result = mmr("query", pairs, top_k=5)
        assert result == pairs
