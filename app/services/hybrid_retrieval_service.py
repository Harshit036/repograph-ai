from rank_bm25 import BM25Okapi
from app.core.user_context import get_user_id
from app.storage.user_stores import get_chunks
from app.services.vector_db_service import search_similar_chunks


def bm25_search(query: str, top_k: int = 10) -> list:
    chunks = get_chunks(get_user_id())
    if not chunks:
        return []

    corpus = [c["content"].lower().split() for c in chunks]
    bm25   = BM25Okapi(corpus)
    scores = bm25.get_scores(query.lower().split())
    top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
    return [chunks[i] for i in top_indices]


def reciprocal_rank_fusion(rankings: list, k: int = 60) -> dict:
    scores = {}
    for ranking in rankings:
        for rank, doc_content in enumerate(ranking):
            scores[doc_content] = scores.get(doc_content, 0) + 1 / (k + rank + 1)
    return scores


def hybrid_search(query: str, query_embedding: list, top_k: int = 5) -> list:
    user_id = get_user_id()
    fetch_k = top_k * 2

    semantic_results = search_similar_chunks(query_embedding, user_id=user_id, top_k=fetch_k)
    semantic_docs    = semantic_results["documents"][0]
    semantic_metas   = semantic_results["metadatas"][0]
    meta_map = {doc: meta for doc, meta in zip(semantic_docs, semantic_metas)}

    bm25_results = bm25_search(query, top_k=fetch_k)
    for chunk in bm25_results:
        if chunk["content"] not in meta_map:
            meta_map[chunk["content"]] = chunk["metadata"]

    rrf_scores  = reciprocal_rank_fusion(
        [semantic_docs, [c["content"] for c in bm25_results]]
    )
    sorted_docs = sorted(rrf_scores, key=lambda d: rrf_scores[d], reverse=True)[:top_k]
    return [(doc, meta_map[doc]) for doc in sorted_docs]
